#!/usr/bin/env python3
"""
DaVinci Resolve Bridge
Script Python pour communiquer avec l'API DaVinci Resolve
Appelé depuis Node.js via child_process
"""

import sys
import os
import json
from pathlib import Path

# Ajouter le chemin du module DaVinciResolveScript selon la plateforme
def get_resolve_script_path():
    """Retourne le chemin du module DaVinci Resolve Script selon l'OS"""
    if sys.platform.startswith("darwin"):
        # macOS
        paths = [
            "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules",
            os.path.expanduser("~/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules"),
        ]
    elif sys.platform.startswith("win"):
        # Windows
        paths = [
            os.path.join(os.environ.get("PROGRAMDATA", "C:\\ProgramData"), 
                        "Blackmagic Design", "DaVinci Resolve", "Support", "Developer", "Scripting", "Modules"),
            os.path.join(os.environ.get("APPDATA", ""), 
                        "Blackmagic Design", "DaVinci Resolve", "Support", "Developer", "Scripting", "Modules"),
        ]
    else:
        # Linux
        paths = [
            "/opt/resolve/Developer/Scripting/Modules",
            os.path.expanduser("~/.local/share/DaVinciResolve/Support/Developer/Scripting/Modules"),
        ]
    
    for path in paths:
        if os.path.exists(path):
            return path
    return None


def initialize_resolve():
    """Initialise la connexion à DaVinci Resolve"""
    script_path = get_resolve_script_path()
    
    if script_path is None:
        return None, "DaVinci Resolve scripting module not found"
    
    if script_path not in sys.path:
        sys.path.append(script_path)
    
    try:
        import DaVinciResolveScript as dvr
        resolve = dvr.scriptapp("Resolve")
        
        if resolve is None:
            return None, "DaVinci Resolve is not running"
        
        return resolve, None
    except ImportError as e:
        return None, f"Failed to import DaVinciResolveScript: {str(e)}"
    except Exception as e:
        return None, f"Failed to connect to DaVinci Resolve: {str(e)}"


def get_status():
    """Vérifie si Resolve est connecté et retourne le statut"""
    resolve, error = initialize_resolve()
    
    if error:
        return {
            "connected": False,
            "error": error,
            "project": None,
            "mediaPoolFolder": None
        }
    
    # Obtenir le projet courant
    project_manager = resolve.GetProjectManager()
    current_project = project_manager.GetCurrentProject()
    
    if current_project is None:
        return {
            "connected": True,
            "error": "No active project in DaVinci Resolve",
            "project": None,
            "mediaPoolFolder": None
        }
    
    project_name = current_project.GetName()
    
    # Obtenir le Media Pool
    media_pool = current_project.GetMediaPool()
    current_folder = media_pool.GetCurrentFolder()
    folder_name = current_folder.GetName() if current_folder else "Master"
    
    return {
        "connected": True,
        "error": None,
        "project": project_name,
        "mediaPoolFolder": folder_name
    }


def find_or_create_folder_path(media_pool, root_folder, folder_path):
    """
    Trouve ou crée un chemin de dossiers imbriqués.
    Ex: "TersaFork/Imports from disk" -> crée TersaFork, puis Imports from disk dedans
    
    Args:
        media_pool: L'objet MediaPool de DaVinci Resolve
        root_folder: Le dossier racine du Media Pool
        folder_path: Le chemin à créer (séparé par "/")
    
    Returns:
        Le dossier final, ou root_folder si erreur
    """
    if not folder_path:
        return root_folder
    
    parts = folder_path.split('/')
    current_folder = root_folder
    
    for part in parts:
        part = part.strip()
        if not part:
            continue
        
        # Chercher si le sous-dossier existe
        subfolders = current_folder.GetSubFolderList()
        found = False
        
        for folder in subfolders:
            if folder.GetName() == part:
                current_folder = folder
                found = True
                break
        
        if not found:
            # Créer le sous-dossier
            new_folder = media_pool.AddSubFolder(current_folder, part)
            if new_folder:
                current_folder = new_folder
            else:
                # Échec de création, retourner le dossier courant
                return current_folder
    
    return current_folder


def import_media(file_path, target_folder=None, clip_name=None, metadata=None):
    """
    Importe un fichier média dans le Media Pool de DaVinci Resolve
    
    Args:
        file_path: Chemin absolu du fichier à importer
        target_folder: Chemin du dossier cible (supporte "/" pour les sous-dossiers)
        clip_name: Nom du clip dans DVR (optionnel)
        metadata: Dict avec les métadonnées (scene, comments, description)
    
    Returns:
        dict avec le résultat de l'import
    """
    resolve, error = initialize_resolve()
    
    if error:
        return {
            "success": False,
            "error": error,
            "project": None,
            "folder": None
        }
    
    # Vérifier que le fichier existe
    if not os.path.exists(file_path):
        return {
            "success": False,
            "error": f"File not found: {file_path}",
            "project": None,
            "folder": None
        }
    
    # Obtenir le projet courant
    project_manager = resolve.GetProjectManager()
    current_project = project_manager.GetCurrentProject()
    
    if current_project is None:
        return {
            "success": False,
            "error": "No active project in DaVinci Resolve",
            "project": None,
            "folder": None
        }
    
    project_name = current_project.GetName()
    
    # Obtenir le Media Pool
    media_pool = current_project.GetMediaPool()
    root_folder = media_pool.GetRootFolder()
    
    # Naviguer vers le dossier cible (supporte les sous-dossiers avec "/")
    target_media_folder = root_folder
    folder_name = "Master"
    
    if target_folder:
        target_media_folder = find_or_create_folder_path(media_pool, root_folder, target_folder)
        folder_name = target_media_folder.GetName()
    
    # Définir le dossier courant
    media_pool.SetCurrentFolder(target_media_folder)
    
    # Importer le média
    imported_clips = media_pool.ImportMedia([file_path])
    
    if imported_clips and len(imported_clips) > 0:
        clip = imported_clips[0]
        final_clip_name = clip.GetName() if clip else os.path.basename(file_path)
        
        # Renommer le clip si un nom est fourni
        if clip and clip_name:
            try:
                clip.SetClipProperty("Clip Name", clip_name)
                final_clip_name = clip_name
            except Exception:
                # Si SetClipProperty échoue, essayer SetName
                try:
                    # Note: SetName peut ne pas être disponible selon la version de Resolve
                    pass
                except Exception:
                    pass
        
        # Appliquer les métadonnées si fournies
        if clip and metadata:
            try:
                # Les métadonnées disponibles dans DaVinci Resolve
                # Scene, Comments, Description sont des champs standard
                if metadata.get("scene"):
                    clip.SetMetadata("Scene", metadata["scene"])
                if metadata.get("comments"):
                    clip.SetMetadata("Comments", metadata["comments"])
                if metadata.get("description"):
                    clip.SetMetadata("Description", metadata["description"])
            except Exception as meta_error:
                # Les métadonnées ont échoué mais l'import a réussi
                print(f"Warning: Failed to set metadata: {meta_error}", file=sys.stderr)
        
        return {
            "success": True,
            "error": None,
            "project": project_name,
            "folder": folder_name,
            "clipName": final_clip_name
        }
    else:
        return {
            "success": False,
            "error": "Failed to import media into DaVinci Resolve",
            "project": project_name,
            "folder": folder_name
        }


def list_folders():
    """Liste tous les dossiers du Media Pool"""
    resolve, error = initialize_resolve()
    
    if error:
        return {
            "success": False,
            "error": error,
            "folders": []
        }
    
    project_manager = resolve.GetProjectManager()
    current_project = project_manager.GetCurrentProject()
    
    if current_project is None:
        return {
            "success": False,
            "error": "No active project",
            "folders": []
        }
    
    media_pool = current_project.GetMediaPool()
    root_folder = media_pool.GetRootFolder()
    
    def get_folder_tree(folder, path=""):
        """Récursivement obtient l'arborescence des dossiers"""
        folders = []
        name = folder.GetName()
        current_path = f"{path}/{name}" if path else name
        
        folders.append({
            "name": name,
            "path": current_path
        })
        
        subfolders = folder.GetSubFolderList()
        for subfolder in subfolders:
            folders.extend(get_folder_tree(subfolder, current_path))
        
        return folders
    
    all_folders = get_folder_tree(root_folder)
    
    return {
        "success": True,
        "error": None,
        "folders": all_folders
    }


def create_folder(folder_name, parent_path=None):
    """Crée un nouveau dossier dans le Media Pool"""
    resolve, error = initialize_resolve()
    
    if error:
        return {
            "success": False,
            "error": error
        }
    
    project_manager = resolve.GetProjectManager()
    current_project = project_manager.GetCurrentProject()
    
    if current_project is None:
        return {
            "success": False,
            "error": "No active project"
        }
    
    media_pool = current_project.GetMediaPool()
    root_folder = media_pool.GetRootFolder()
    
    # Trouver le dossier parent
    parent_folder = root_folder
    if parent_path:
        subfolders = root_folder.GetSubFolderList()
        for folder in subfolders:
            if folder.GetName() == parent_path:
                parent_folder = folder
                break
    
    # Créer le nouveau dossier
    new_folder = media_pool.AddSubFolder(parent_folder, folder_name)
    
    if new_folder:
        return {
            "success": True,
            "error": None,
            "folderName": folder_name
        }
    else:
        return {
            "success": False,
            "error": f"Failed to create folder '{folder_name}'"
        }


def focus_and_search(clip_name, target_folder=None, search_shortcut=None):
    """
    Met DaVinci Resolve au premier plan et recherche un clip par son nom
    Utilise le presse-papiers pour éviter les problèmes d'encodage
    
    Args:
        clip_name: Nom du clip à rechercher
        target_folder: Dossier où naviguer avant la recherche (optionnel)
        search_shortcut: Raccourci clavier pour la recherche (ex: "cmd+shift+f")
    
    Returns:
        dict avec le résultat
    """
    import subprocess
    import time
    
    resolve, error = initialize_resolve()
    
    if error:
        return {
            "success": False,
            "error": error
        }
    
    # Obtenir le projet courant
    project_manager = resolve.GetProjectManager()
    current_project = project_manager.GetCurrentProject()
    
    if current_project is None:
        return {
            "success": False,
            "error": "No active project in DaVinci Resolve"
        }
    
    project_name = current_project.GetName()
    
    # Naviguer vers le dossier cible si spécifié (supporte les sous-dossiers)
    if target_folder:
        media_pool = current_project.GetMediaPool()
        root_folder = media_pool.GetRootFolder()
        
        target_media_folder = find_or_create_folder_path(media_pool, root_folder, target_folder)
        media_pool.SetCurrentFolder(target_media_folder)
    
    # Mettre DaVinci Resolve au premier plan (macOS)
    if sys.platform.startswith("darwin"):
        try:
            # 1. Copier le nom du clip dans le presse-papiers
            process = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE)
            process.communicate(clip_name.encode('utf-8'))
            
            # 2. Activer DaVinci Resolve
            subprocess.run([
                'osascript', '-e',
                'tell application "DaVinci Resolve" to activate'
            ], check=True)
            
            # 3. Si un raccourci est configuré, l'utiliser pour ouvrir la recherche
            if search_shortcut:
                time.sleep(0.5)
                
                # Parser le raccourci (ex: "cmd+shift+f" -> keystroke "f" using {command down, shift down})
                parts = search_shortcut.lower().split('+')
                key = parts[-1]  # La dernière partie est la touche
                modifiers = parts[:-1]  # Le reste sont les modificateurs
                
                modifier_map = {
                    'cmd': 'command down',
                    'command': 'command down',
                    'shift': 'shift down',
                    'alt': 'option down',
                    'option': 'option down',
                    'ctrl': 'control down',
                    'control': 'control down',
                }
                
                modifier_str = ', '.join([modifier_map.get(m, '') for m in modifiers if m in modifier_map])
                
                if modifier_str:
                    apple_script = f'''
                    tell application "System Events"
                        tell process "DaVinci Resolve"
                            keystroke "{key}" using {{{modifier_str}}}
                            delay 0.3
                            keystroke "v" using command down
                        end tell
                    end tell
                    '''
                    try:
                        subprocess.run(['osascript', '-e', apple_script], check=True)
                        return {
                            "success": True,
                            "error": None,
                            "project": project_name,
                            "searchedClip": clip_name,
                            "autoSearched": True
                        }
                    except subprocess.CalledProcessError:
                        # Si ça échoue, on continue avec le mode manuel
                        pass
            
            # Mode manuel : le nom est dans le presse-papiers
            return {
                "success": True,
                "error": None,
                "project": project_name,
                "searchedClip": clip_name,
                "clipboardReady": True
            }
        except subprocess.CalledProcessError as e:
            return {
                "success": False,
                "error": f"Failed to activate DaVinci Resolve: {str(e)}"
            }
    
    elif sys.platform.startswith("win"):
        # Windows - utiliser pyautogui si disponible
        try:
            import pyautogui
            import pyperclip
            
            # Copier dans le presse-papiers
            pyperclip.copy(clip_name)
            
            # Trouver et activer la fenêtre DaVinci Resolve
            subprocess.run(['powershell', '-Command', 
                '(New-Object -ComObject WScript.Shell).AppActivate("DaVinci Resolve")'], 
                check=True)
            
            time.sleep(0.5)
            
            # Ctrl+F pour ouvrir la recherche
            pyautogui.hotkey('ctrl', 'f')
            time.sleep(0.3)
            
            # Ctrl+V pour coller
            pyautogui.hotkey('ctrl', 'v')
            
            return {
                "success": True,
                "error": None,
                "project": project_name,
                "searchedClip": clip_name
            }
        except ImportError as ie:
            return {
                "success": False,
                "error": f"Missing module: {str(ie)}. Run: pip install pyautogui pyperclip"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to automate DaVinci Resolve: {str(e)}"
            }
    
    else:
        return {
            "success": False,
            "error": f"Platform {sys.platform} not supported for UI automation"
        }


def main():
    """Point d'entrée principal - lit les commandes depuis stdin"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == "status":
            result = get_status()
        
        elif command == "import":
            if len(sys.argv) < 3:
                result = {"success": False, "error": "No file path provided"}
            else:
                file_path = sys.argv[2]
                target_folder = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
                clip_name = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else None
                
                # Les métadonnées sont passées en JSON dans le 5ème argument
                metadata = None
                if len(sys.argv) > 5:
                    try:
                        metadata = json.loads(sys.argv[5])
                    except json.JSONDecodeError:
                        pass
                
                result = import_media(file_path, target_folder, clip_name, metadata)
        
        elif command == "list-folders":
            result = list_folders()
        
        elif command == "create-folder":
            if len(sys.argv) < 3:
                result = {"success": False, "error": "No folder name provided"}
            else:
                folder_name = sys.argv[2]
                parent_path = sys.argv[3] if len(sys.argv) > 3 else None
                result = create_folder(folder_name, parent_path)
        
        elif command == "focus-search":
            if len(sys.argv) < 3:
                result = {"success": False, "error": "No clip name provided"}
            else:
                clip_name = sys.argv[2]
                target_folder = sys.argv[3] if len(sys.argv) > 3 else None
                search_shortcut = sys.argv[4] if len(sys.argv) > 4 else None
                result = focus_and_search(clip_name, target_folder, search_shortcut)
        
        else:
            result = {"error": f"Unknown command: {command}"}
        
        print(json.dumps(result))
    
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
