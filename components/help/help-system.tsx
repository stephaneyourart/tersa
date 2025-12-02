'use client';

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, HelpCircle, ArrowLeft, BookOpen, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Fuse from 'fuse.js';
import { HELP_CONTENT, type HelpArticle } from '@/lib/help-content';
import { cn } from '@/lib/utils';

export function HelpSystem() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'index' | 'article'>('index');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Configuration de Fuse.js pour la recherche floue
  const fuse = useMemo(() => {
    return new Fuse(HELP_CONTENT, {
      keys: [
        { name: 'title', weight: 0.7 },
        { name: 'tags', weight: 0.5 },
        { name: 'content', weight: 0.3 },
        { name: 'category', weight: 0.2 }
      ],
      threshold: 0.3, // Sensibilité (plus bas = plus strict)
      includeScore: true
    });
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery) return HELP_CONTENT;
    return fuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, fuse]);

  // Grouper par catégorie si pas de recherche
  const groupedContent = useMemo(() => {
    if (searchQuery) return null;
    const groups: Record<string, HelpArticle[]> = {};
    HELP_CONTENT.forEach(article => {
      if (!groups[article.category]) groups[article.category] = [];
      groups[article.category].push(article);
    });
    return groups;
  }, [searchQuery]);

  const handleArticleClick = (article: HelpArticle) => {
    setSelectedArticle(article);
    setView('article');
  };

  const handleBack = () => {
    setView('index');
    setSelectedArticle(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 h-10 w-10 rounded-full shadow-lg bg-white hover:bg-gray-100 text-black border-gray-300 z-50 transition-transform hover:scale-105"
        >
          <HelpCircle className="h-6 w-6 text-black" />
          <span className="sr-only">Aide</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 bg-white text-black overflow-hidden sm:rounded-xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            {view === 'article' && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="mr-1 h-8 w-8 text-black hover:text-black">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="text-xl font-semibold tracking-tight text-black">
              {view === 'article' ? selectedArticle?.title : 'Centre d\'Aide'}
            </DialogTitle>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white">
          {view === 'index' ? (
            <>
              {/* Search Bar */}
              <div className="p-4 pb-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher (ex: générer image, raccourcis...)"
                    className="pl-9 bg-gray-50 border-gray-200 focus-visible:ring-black text-black"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {/* Results List */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-4">
                  {searchQuery ? (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-500 mb-3">Résultats pour "{searchQuery}"</h3>
                      {searchResults.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          Aucun résultat trouvé. Essayez d'autres mots-clés.
                        </div>
                      ) : (
                        searchResults.map((article) => (
                          <ArticleCard key={article.id} article={article} onClick={() => handleArticleClick(article)} />
                        ))
                      )}
                    </div>
                  ) : (
                    <Accordion type="multiple" defaultValue={groupedContent ? Object.keys(groupedContent) : []} className="space-y-2">
                      {groupedContent && Object.entries(groupedContent).map(([category, articles]) => (
                        <AccordionItem key={category} value={category} className="border border-gray-200 rounded-lg bg-white">
                          <AccordionTrigger className="px-4 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                                {category}
                              </span>
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                {articles.length}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 pt-2">
                              {articles.map((article) => (
                                <ArticleCard key={article.id} article={article} onClick={() => handleArticleClick(article)} />
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Article View */
            <div className="flex-1 min-h-0 overflow-y-auto bg-white">
              <div className="p-6 sm:p-8">
                <div className="max-w-2xl mx-auto">
                  <div className="flex flex-wrap gap-2 mb-6">
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-200">
                      {selectedArticle?.category}
                    </Badge>
                    {selectedArticle?.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-gray-500 border-gray-200">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="help-article-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedArticle?.content || ''}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArticleCard({ article, onClick }: { article: HelpArticle; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start p-3 w-full text-left rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all group bg-white shadow-sm"
    >
      <div className="mt-1 mr-3 text-gray-400 group-hover:text-black transition-colors">
        <BookOpen className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <h4 className="font-medium text-gray-900 group-hover:underline decoration-gray-400 underline-offset-4">
          {article.title}
        </h4>
        <p className="text-sm text-gray-500 line-clamp-2 mt-1">
          {article.content.replace(/[#*`]/g, '').slice(0, 100)}...
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

