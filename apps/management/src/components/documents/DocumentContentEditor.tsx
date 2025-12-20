// =============================================================================
// Document Content Editor Component - Redesigned Layout
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Document } from '@/types';
import { contentAPI, apiRequest } from '@/lib/api';
import { useNotification } from '@/contexts/NotificationContext';
import styles from '@/styles/components/documents/DocumentContentEditor.module.scss';

interface CSSClass {
  id: string;
  title: string;
  css: string;
  htmlElement: string;
  isPredefined?: boolean; // Classi predefinite non cancellabili
}

interface DocumentContentEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string, cssClasses?: CSSClass[]) => Promise<void>;
  document: Document;
}

// Costante per il prefisso CSS
const CSS_PREFIX = 'tpn_documents';

export function DocumentContentEditor({
  isOpen,
  onClose,
  onSave,
  document
}: DocumentContentEditorProps) {
  const { showPrompt, showToast } = useNotification();
  const [content, setContent] = useState('');
  const [cssClasses, setCssClasses] = useState<CSSClass[]>([]);
  const [activeTab, setActiveTab] = useState<'content' | 'css'>('content');
  const [loading, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [showHTMLEditor, setShowHTMLEditor] = useState(false);
  const [showToolPanel, setShowToolPanel] = useState(false);
  const [showULMenu, setShowULMenu] = useState(false);
  const [showIMGMenu, setShowIMGMenu] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const isUpdating = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Carica contenuto e CSS globali esistenti
  useEffect(() => {
    const loadGlobalCSS = async () => {
      if (isOpen && document) {
        setContent(document.summary || '');
        
        // Definisci le classi predefinite
        const predefinedClasses = [
          // Classi predefinite per i bottoni veloci
          { id: 'pred_bold', title: 'bold', css: 'font-weight: bold;', htmlElement: 'strong', isPredefined: true },
          { id: 'pred_italic', title: 'italic', css: 'font-style: italic;', htmlElement: 'em', isPredefined: true },
          { id: 'pred_underline', title: 'underline', css: 'text-decoration: underline;', htmlElement: 'u', isPredefined: true },
          { id: 'pred_ul', title: 'ul', css: 'list-style-type: disc;\nmargin: 0.5rem 0;\npadding-left: 1.5rem;', htmlElement: 'ul', isPredefined: true },
          { id: 'pred_img', title: 'img', css: 'max-width: 100%;\nheight: auto;\ndisplay: block;\nmargin: 1rem 0;', htmlElement: 'picture', isPredefined: true },
          { id: 'pred_link', title: 'link', css: 'color: #007acc;\ntext-decoration: underline;\ncursor: pointer;', htmlElement: 'a', isPredefined: true },
          // Allineamenti
          { id: 'pred_align_left', title: 'align-left', css: 'text-align: left;', htmlElement: 'div', isPredefined: true },
          { id: 'pred_align_center', title: 'align-center', css: 'text-align: center;', htmlElement: 'div', isPredefined: true },
          { id: 'pred_align_right', title: 'align-right', css: 'text-align: right;', htmlElement: 'div', isPredefined: true },
          { id: 'pred_align_justify', title: 'align-justify', css: 'text-align: justify;', htmlElement: 'div', isPredefined: true },
          // Classi custom predefinite di esempio
          { id: 'custom_titolo', title: 'titolo', css: 'font-size: 2rem;\nfont-weight: bold;\nmargin: 1.5rem 0 1rem 0;\ncolor: #d4af37;', htmlElement: 'h1', isPredefined: false },
          { id: 'custom_paragrafo', title: 'paragrafo', css: 'margin: 1rem 0;\nline-height: 1.6;\ntext-align: justify;', htmlElement: 'p', isPredefined: false },
          { id: 'custom_note_importanti', title: 'note-importanti', css: 'background: #fff3cd;\nborder: 1px solid #ffeaa7;\npadding: 15px;\nmargin: 1rem 0;\nborder-radius: 4px;\ncolor: #856404;', htmlElement: 'div', isPredefined: false },
          // Colori predefiniti
          { id: 'color_oro', title: 'oro', css: 'color: #d4af37;', htmlElement: 'span', isPredefined: false },
          { id: 'color_rosso', title: 'rosso', css: 'color: #dc3545;', htmlElement: 'span', isPredefined: false },
          { id: 'color_verde', title: 'verde', css: 'color: #28a745;', htmlElement: 'span', isPredefined: false },
          { id: 'color_blu', title: 'blu', css: 'color: #007bff;', htmlElement: 'span', isPredefined: false },
          { id: 'color_scuro', title: 'scuro', css: 'color: #343a40;', htmlElement: 'span', isPredefined: false }
        ];

        try {
          // Prova a caricare i dati CSS globali esistenti
          const response = await apiRequest('/admin/documents/css/data');
          
          if (response.success && response.data?.cssClasses) {
            const savedClasses = response.data.cssClasses || [];
            
            // Merge delle classi predefinite con eventuali modifiche salvate
            const mergedPredefinedClasses = predefinedClasses.map(predefined => {
              const saved = savedClasses.find((cls: CSSClass) => 
                cls.title === predefined.title && cls.isPredefined
              );
              return saved ? { ...predefined, css: saved.css } : predefined;
            });
            
            // Aggiungi le classi custom (non predefinite)
            const customClasses = savedClasses.filter((cls: CSSClass) => !cls.isPredefined);
            
            setCssClasses([...mergedPredefinedClasses, ...customClasses]);
            return;
          }
        } catch (error) {
          console.log('No existing global CSS found, using defaults');
        }
        
        // Fallback: usa classi predefinite + esempi se non esistono CSS globali
        const exampleClasses = [
          { id: '1', title: 'Titolo', css: 'color: #d4af37;\nfont-size: 24px;\nfont-weight: bold;\ntext-align: center;\nmargin: 16px 0;', htmlElement: 'h2' },
          { id: '2', title: 'Paragrafo', css: 'line-height: 1.6;\nmargin: 12px 0;\ncolor: #333;', htmlElement: 'p' },
          { id: '3', title: 'Note', css: 'background: rgba(255, 193, 7, 0.2);\npadding: 12px;\nborder-left: 4px solid #ffc107;\nmargin: 16px 0;\nfont-style: italic;', htmlElement: 'div' }
        ];
        
        setCssClasses([...predefinedClasses, ...exampleClasses]);
      }
    };

    loadGlobalCSS();
  }, [isOpen, document]);

  // Cleanup del timer quando il componente viene smontato
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Aggiorna preview in tempo reale
  useEffect(() => {
    if (previewRef.current) {
      updatePreview();
    }
  }, [content, cssClasses, showHTMLEditor, activeTab]);

  // Sincronizza contenuto quando si cambia modalità di editing
  useEffect(() => {
    if (!previewRef.current) return;
    
    if (showHTMLEditor) {
      // Passaggio a modalità HTML: aggiorna il preview con il contenuto HTML
      updatePreview();
    } else {
      // Passaggio a modalità editabile: sincronizza il contenuto dal preview
      if (previewRef.current.innerHTML !== content) {
        previewRef.current.innerHTML = content;
      }
    }
  }, [showHTMLEditor]);

  // Genera CSS completo con prefisso
  const generateCSS = (): string => {
    return cssClasses.map(cssClass => 
      `.${CSS_PREFIX}__${cssClass.title} {\n${cssClass.css}\n}`
    ).join('\n\n');
  };

  // Aggiorna la preview preservando la posizione del cursore
  const updatePreview = () => {
    if (!previewRef.current) return;

    // Salva la posizione del cursore
    const selection = globalThis.getSelection();
    let cursorPosition = null;
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      cursorPosition = {
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset
      };
    }

    isUpdating.current = true;

    // Applica il contenuto solo se diverso dall'attuale
    if (previewRef.current.innerHTML !== content) {
      previewRef.current.innerHTML = content;
    }

    // Rimuovi stili precedenti nel preview stesso
    const existingStyle = previewRef.current.querySelector('style[data-custom-css]');
    if (existingStyle) existingStyle.remove();

    // Aggiungi nuovi stili se presenti - direttamente nel preview
    if (cssClasses.length > 0) {
      const styleElement = globalThis.document?.createElement('style');
      if (styleElement) {
        styleElement.setAttribute('data-custom-css', 'true');
        styleElement.textContent = generateCSS();
        previewRef.current.appendChild(styleElement);
      }
    }

    // Ripristina la posizione del cursore
    if (cursorPosition && selection) {
      try {
        const range = globalThis.document?.createRange();
        if (range) {
          range.setStart(cursorPosition.startContainer, cursorPosition.startOffset);
          range.setEnd(cursorPosition.endContainer, cursorPosition.endOffset);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch (error) {
        // Ignora errori di ripristino cursore
      }
    }

    isUpdating.current = false;
  };

  // Aggiorna il contenuto senza perdere il focus
  const updateContentFromPreview = () => {
    if (!previewRef.current || showHTMLEditor || isUpdating.current) return;
    
    // Clona il contenuto e rimuovi gli elementi style aggiunti dal CSS
    const previewClone = previewRef.current.cloneNode(true) as HTMLElement;
    const styleElements = previewClone.querySelectorAll('style[data-custom-css]');
    styleElements.forEach(el => el.remove());
    
    const newContent = previewClone.innerHTML;
    
    // Solo aggiorna se il contenuto è effettivamente cambiato
    if (newContent !== content) {
      setContent(newContent);
    }
  };

  // Gestisce input con debounce per evitare perdita focus
  const handlePreviewInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (!previewRef.current || showHTMLEditor || isUpdating.current) return;
    
    // Previene comportamenti di default che potrebbero interferire
    e.stopPropagation();
    
    // Cancella il timer precedente
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Imposta un timer più lungo per evitare aggiornamenti durante la digitazione
    debounceTimer.current = setTimeout(() => {
      updateContentFromPreview();
    }, 1000); // Aumentato a 1 secondo per evitare interferenze
  };

  // Gestisce keydown per preservare il comportamento normale dei tasti
  const handlePreviewKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Non fare nulla per i tasti di modifica (Shift, Ctrl, Alt) da soli
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
      return;
    }
    
    // Previeni comportamenti indesiderati ma permetti la digitazione normale
    e.stopPropagation();
  };

  // Gestisce blur (quando l'utente clicca fuori) - aggiornamento immediato
  const handlePreviewBlur = () => {
    // Cancella il debounce se presente
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    
    // Aggiorna immediatamente
    updateContentFromPreview();
  };

  // Sincronizza contenuto dall'editor HTML al preview
  const syncFromHTMLEditor = (newContent: string) => {
    // Rimuovi eventuali tag <style> dal contenuto dell'editor
    const cleanContent = newContent.replace(/<style[^>]*data-custom-css[^>]*>[\s\S]*?<\/style>/gi, '');
    
    setContent(cleanContent);
    if (previewRef.current && !showHTMLEditor) {
      previewRef.current.innerHTML = cleanContent;
    }
  };

  // Inserisce elementi usando le classi CSS predefinite
  const insertStyle = async (className: string) => {
    // Se l'editor HTML è aperto, lavora con la textarea
    if (showHTMLEditor) {
      const textarea = globalThis.document?.getElementById('content-editor') as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);

      await insertStyleInHTML(className, selectedText, start, end);

      // Rimetti il focus e la selezione sulla textarea
      setTimeout(() => {
        textarea.focus();
      }, 0);
    } else {
      // Se stiamo editando direttamente il preview, inserisci l'elemento
      await insertStyleInPreview(className);
    }
  };

  // Inserisce stile nell'HTML (per editor HTML)
  const insertStyleInHTML = async (className: string, selectedText: string, start: number, end: number) => {
    const cssClass = cssClasses.find(cls => cls.title === className && cls.isPredefined);
    if (!cssClass) return;

    let newContent = '';
    const element = cssClass.htmlElement;
    const classAttr = `${CSS_PREFIX}__${className}`;
    
    // Gestione speciale per alcuni elementi
    switch (className) {
      case 'img':
        const imageUrl = await showPrompt('Inserisci URL dell\'immagine:', '');
        const imageAlt = await showPrompt('Inserisci descrizione immagine (alt text):', selectedText || 'Descrizione immagine');

        if (imageUrl) {
          newContent = content.substring(0, start) +
            `<${element} class="${classAttr}">
  <img src="${imageUrl}" alt="${imageAlt || 'Descrizione immagine'}" />
  <label>${imageAlt || 'Descrizione immagine'}</label>
</${element}>` + content.substring(end);
        } else {
          return; // Annulla se non inserisce URL
        }
        break;
      case 'ul':
        const listItem = selectedText || 'Elemento lista';
        newContent = content.substring(0, start) + 
          `<${element} class="${classAttr}"><li>${listItem}</li></${element}>` + content.substring(end);
        break;
      default:
        const defaultText = selectedText || getDefaultText(className);
        newContent = content.substring(0, start) + 
          `<${element} class="${classAttr}">${defaultText}</${element}>` + content.substring(end);
        break;
    }
    
    setContent(newContent);
  };

  // Inserisce stile nel preview editabile
  const insertStyleInPreview = async (className: string) => {
    if (!previewRef.current) return;

    const cssClass = cssClasses.find(cls => cls.title === className && cls.isPredefined);
    if (!cssClass) return;

    const selection = globalThis.getSelection();
    const selectedText = selection?.toString() || '';
    
    const element = cssClass.htmlElement;
    const classAttr = `${CSS_PREFIX}__${className}`;
    
    // Crea il nuovo elemento
    const newElement = globalThis.document?.createElement(element);
    if (!newElement) return;
    
    newElement.className = classAttr;
    
    // Gestione speciale per alcuni elementi
    switch (className) {
      case 'img':
        const imageUrl = await showPrompt('Inserisci URL dell\'immagine:', '');
        const imageAlt = await showPrompt('Inserisci descrizione immagine (alt text):', selectedText || 'Descrizione immagine');

        if (imageUrl) {
          const picture = newElement as HTMLElement;
          const img = globalThis.document?.createElement('img');
          const label = globalThis.document?.createElement('label');
          if (img && label) {
            img.src = imageUrl;
            img.alt = imageAlt || 'Descrizione immagine';
            label.textContent = imageAlt || 'Descrizione immagine';
            picture.appendChild(img);
            picture.appendChild(label);
          }
        } else {
          return; // Annulla se non inserisce URL
        }
        break;
      case 'ul':
        const li = globalThis.document?.createElement('li');
        if (li) {
          li.textContent = selectedText || 'Elemento lista';
          newElement.appendChild(li);
        }
        break;
      default:
        newElement.textContent = selectedText || getDefaultText(className);
        break;
    }
    
    // Inserisci l'elemento nel DOM
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(newElement);
      selection.removeAllRanges();
    } else {
      previewRef.current.appendChild(newElement);
    }
    
    // Sincronizza il contenuto
    updateContentFromPreview();
  };

  // Funzioni per inserire allineamento
  const insertAlignment = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    if (showHTMLEditor) {
      const textarea = globalThis.document?.getElementById('content-editor') as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end) || 'Testo allineato';
      
      const newContent = content.substring(0, start) + 
        `<div style="text-align: ${alignment};">${selectedText}</div>` + 
        content.substring(end);
      
      setContent(newContent);
      
      setTimeout(() => {
        textarea.focus();
        const newStart = start + newContent.length - content.length - selectedText.length;
        textarea.setSelectionRange(newStart, newStart);
      }, 0);
    } else {
      insertAlignmentInPreview(alignment);
    }
  };

  // Inserisce allineamento nel preview editabile
  const insertAlignmentInPreview = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    if (!previewRef.current) return;
    
    const selection = globalThis.getSelection();
    const selectedText = selection?.toString() || 'Testo allineato';
    
    const newElement = globalThis.document?.createElement('div');
    if (!newElement) return;
    
    newElement.style.textAlign = alignment;
    newElement.textContent = selectedText;
    
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(newElement);
      selection.removeAllRanges();
    } else {
      previewRef.current.appendChild(newElement);
    }
    
    updateContentFromPreview();
  };

  // Funzioni per gestire i sottomenu floating
  const insertListType = (listType: 'ul' | 'ol') => {
    const listHTML = listType === 'ul' 
      ? '<ul><li>Elemento 1</li><li>Elemento 2</li><li>Elemento 3</li></ul>'
      : '<ol><li>Primo elemento</li><li>Secondo elemento</li><li>Terzo elemento</li></ol>';
    
    if (showHTMLEditor) {
      const textarea = globalThis.document?.getElementById('content-editor') as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const newContent = content.substring(0, start) + listHTML + content.substring(start);
      setContent(newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + listHTML.length, start + listHTML.length);
      }, 0);
    } else {
      insertListInPreview(listType);
    }
    
    setShowULMenu(false);
  };

  const insertListInPreview = (listType: 'ul' | 'ol') => {
    if (!previewRef.current) return;
    
    const newElement = globalThis.document?.createElement(listType);
    if (!newElement) return;
    
    for (let i = 1; i <= 3; i++) {
      const li = globalThis.document?.createElement('li');
      if (li) {
        li.textContent = listType === 'ul' ? `Elemento ${i}` : `${i}° elemento`;
        newElement.appendChild(li);
      }
    }
    
    previewRef.current.appendChild(newElement);
    updateContentFromPreview();
  };

  const insertImage = (url: string, alt: string) => {
    const imgHTML = `<img src="${url}" alt="${alt}" style="max-width: 100%;" />`;
    
    if (showHTMLEditor) {
      const textarea = globalThis.document?.getElementById('content-editor') as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const newContent = content.substring(0, start) + imgHTML + content.substring(start);
      setContent(newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + imgHTML.length, start + imgHTML.length);
      }, 0);
    } else {
      insertImageInPreview(url, alt);
    }
    
    setShowIMGMenu(false);
  };

  const insertImageInPreview = (url: string, alt: string) => {
    if (!previewRef.current) return;
    
    const newElement = globalThis.document?.createElement('img');
    if (!newElement) return;
    
    newElement.src = url;
    newElement.alt = alt;
    newElement.style.maxWidth = '100%';
    
    previewRef.current.appendChild(newElement);
    updateContentFromPreview();
  };

  const insertLink = (url: string, text: string) => {
    console.log('insertLink called with:', { url, text, showHTMLEditor });
    const linkHTML = `<a href="${url}" target="_blank">${text}</a>`;
    
    if (showHTMLEditor) {
      const textarea = globalThis.document?.getElementById('content-editor') as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);
      
      const finalText = text || selectedText || 'Link';
      const finalHTML = `<a href="${url}" target="_blank">${finalText}</a>`;
      
      const newContent = content.substring(0, start) + finalHTML + content.substring(end);
      setContent(newContent);
      
      setTimeout(() => {
        textarea.focus();
        const newStart = start + finalHTML.length;
        textarea.setSelectionRange(newStart, newStart);
      }, 0);
    } else {
      insertLinkInPreview(url, text);
    }
    
    setShowLinkMenu(false);
  };

  const insertLinkInPreview = (url: string, text: string) => {
    console.log('insertLinkInPreview called with:', { url, text, previewRef: !!previewRef.current });
    if (!previewRef.current) return;
    
    const selection = globalThis.getSelection();
    const selectedText = selection?.toString() || text || 'Link';
    
    const newElement = globalThis.document?.createElement('a');
    if (!newElement) return;
    
    newElement.href = url;
    newElement.target = '_blank';
    newElement.textContent = selectedText;
    
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(newElement);
      selection.removeAllRanges();
    } else {
      previewRef.current.appendChild(newElement);
    }
    
    updateContentFromPreview();
  };

  const insertTable = (rows: number, cols: number) => {
    let tableHTML = '<table style="border-collapse: collapse; width: 100%;"><tbody>';
    
    for (let i = 0; i < rows; i++) {
      tableHTML += '<tr>';
      for (let j = 0; j < cols; j++) {
        tableHTML += `<td style="border: 1px solid #ccc; padding: 8px;">Cella ${i + 1}.${j + 1}</td>`;
      }
      tableHTML += '</tr>';
    }
    tableHTML += '</tbody></table>';
    
    if (showHTMLEditor) {
      const textarea = globalThis.document?.getElementById('content-editor') as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const newContent = content.substring(0, start) + tableHTML + content.substring(start);
      setContent(newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tableHTML.length, start + tableHTML.length);
      }, 0);
    } else {
      insertTableInPreview(rows, cols);
    }
    
    setShowTableMenu(false);
  };

  const insertTableInPreview = (rows: number, cols: number) => {
    if (!previewRef.current) return;
    
    const table = globalThis.document?.createElement('table');
    if (!table) return;
    
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    
    const tbody = globalThis.document?.createElement('tbody');
    if (!tbody) return;
    
    for (let i = 0; i < rows; i++) {
      const tr = globalThis.document?.createElement('tr');
      if (!tr) continue;
      
      for (let j = 0; j < cols; j++) {
        const td = globalThis.document?.createElement('td');
        if (!td) continue;
        
        td.style.border = '1px solid #ccc';
        td.style.padding = '8px';
        td.textContent = `Cella ${i + 1}.${j + 1}`;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    
    table.appendChild(tbody);
    previewRef.current.appendChild(table);
    updateContentFromPreview();
  };

  // Inserisce formattazione nell'editor HTML (per bottoni B/I/U)
  const insertFormattingInHTML = (tag: string) => {
    const textarea = globalThis.document?.getElementById('content-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || getDefaultFormattingText(tag);
    
    const newContent = content.substring(0, start) + 
      `<${tag}>${selectedText}</${tag}>` + 
      content.substring(end);
    
    setContent(newContent);
    
    setTimeout(() => {
      textarea.focus();
      const newStart = start + newContent.length - content.length - selectedText.length;
      textarea.setSelectionRange(newStart, newStart);
    }, 0);
  };

  // Inserisce formattazione nel preview editabile (per bottoni B/I/U)
  const insertFormattingInPreview = (tag: string) => {
    if (!previewRef.current) return;
    
    const selection = globalThis.getSelection();
    const selectedText = selection?.toString() || getDefaultFormattingText(tag);
    
    // Crea il nuovo elemento
    const newElement = globalThis.document?.createElement(tag);
    if (!newElement) return;
    
    newElement.textContent = selectedText;
    
    // Inserisci l'elemento nel DOM
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(newElement);
      selection.removeAllRanges();
    } else {
      previewRef.current.appendChild(newElement);
    }
    
    // Sincronizza il contenuto
    updateContentFromPreview();
  };

  // Inserisce colore (funzione dedicata per i colori)
  const insertColor = (colorName: string) => {
    const colorClass = cssClasses.find(cls => cls.title === colorName && cls.id.startsWith('color_'));
    if (!colorClass) return;

    if (showHTMLEditor) {
      const textarea = globalThis.document?.getElementById('content-editor') as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end) || `Testo ${colorName}`;
      
      const newContent = content.substring(0, start) + 
        `<span class="${CSS_PREFIX}__${colorName}">${selectedText}</span>` + 
        content.substring(end);
      
      setContent(newContent);
      
      setTimeout(() => {
        textarea.focus();
        const newStart = start + newContent.length - content.length - selectedText.length;
        textarea.setSelectionRange(newStart, newStart);
      }, 0);
    } else {
      insertColorInPreview(colorName);
    }
    
    setShowColorMenu(false);
  };

  const insertColorInPreview = (colorName: string) => {
    if (!previewRef.current) return;
    
    const selection = globalThis.getSelection();
    const selectedText = selection?.toString() || `Testo ${colorName}`;
    
    const newElement = globalThis.document?.createElement('span');
    if (!newElement) return;
    
    newElement.className = `${CSS_PREFIX}__${colorName}`;
    newElement.textContent = selectedText;
    
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(newElement);
      selection.removeAllRanges();
    } else {
      previewRef.current.appendChild(newElement);
    }
    
    updateContentFromPreview();
  };

  // Ottieni testo di default per formattazione
  const getDefaultFormattingText = (tag: string): string => {
    switch (tag) {
      case 'strong': return 'Testo in grassetto';
      case 'em': return 'Testo in corsivo';
      case 'u': return 'Testo sottolineato';
      default: return 'Testo formattato';
    }
  };

  // Ottieni testo di default per ogni tipo di elemento
  const getDefaultText = (className: string): string => {
    switch (className) {
      case 'h1': return 'Titolo Principale';
      case 'h2': return 'Sottotitolo';
      case 'p': return 'Paragrafo';
      case 'bold': return 'Testo in grassetto';
      case 'italic': return 'Testo in corsivo';
      default: return 'Testo';
    }
  };

  // Inserisce una classe custom
  const insertClass = (className: string) => {
    if (showHTMLEditor) {
      // Se l'editor HTML è aperto, lavora con la textarea
      const textarea = globalThis.document?.getElementById('content-editor') as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);
      
      const cssClass = cssClasses.find(cls => cls.title === className);
      const htmlElement = cssClass?.htmlElement || 'span';
      
      const newContent = content.substring(0, start) + 
        `<${htmlElement} class="${CSS_PREFIX}__${className}">${selectedText}</${htmlElement}>` + 
        content.substring(end);
      
      setContent(newContent);
      
      setTimeout(() => {
        textarea.focus();
        const newStart = start + newContent.length - content.length - selectedText.length;
        textarea.setSelectionRange(newStart, newStart);
      }, 0);
    } else {
      // Se stiamo editando il preview, inserisci la classe custom
      insertCustomClassInPreview(className);
    }
  };

  // Inserisce classe custom nel preview editabile
  const insertCustomClassInPreview = (className: string) => {
    if (!previewRef.current) return;

    const cssClass = cssClasses.find(cls => cls.title === className);
    const htmlElement = cssClass?.htmlElement || 'span';
    
    const selection = globalThis.getSelection();
    const selectedText = selection?.toString() || 'Testo';
    
    // Crea il nuovo elemento
    const newElement = globalThis.document?.createElement(htmlElement);
    if (!newElement) return;
    
    newElement.className = `${CSS_PREFIX}__${className}`;
    newElement.textContent = selectedText;
    
    // Inserisci l'elemento nel DOM
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(newElement);
      selection.removeAllRanges();
    } else {
      previewRef.current.appendChild(newElement);
    }
    
    // Sincronizza il contenuto
    updateContentFromPreview();
  };

  // Aggiunge una nuova classe CSS
  const addNewCSSClass = () => {
    const newClass: CSSClass = {
      id: Date.now().toString(),
      title: '',
      css: '',
      htmlElement: 'span'
    };
    setCssClasses(prev => [...prev, newClass]);
  };

  // Aggiorna una classe CSS
  const updateCSSClass = (id: string, field: 'title' | 'css' | 'htmlElement', value: string) => {
    setCssClasses(prev => 
      prev.map(cls => 
        cls.id === id ? { ...cls, [field]: value } : cls
      )
    );
  };

  // Rimuove una classe CSS
  const removeCSSClass = (id: string) => {
    setCssClasses(prev => prev.filter(cls => cls.id !== id));
  };

  // Salva contenuto e CSS
  const handleSave = async () => {
    setSaving(true);
    setMessage(null); // Pulisci messaggi precedenti
    try {
      await onSave(content, cssClasses);
      onClose();
    } catch (error) {
      console.error('Error saving document content:', error);
      setMessage({type: 'error', text: 'Errore durante il salvataggio. Riprova.'});
      setSaving(false);
    }
  };

  // Salva CSS globale (tutte le classi, incluse quelle predefinite modificate)
  const handleSaveCSS = async () => {
    setSaving(true);
    setMessage(null); // Pulisci messaggi precedenti
    try {
      // Salva tutte le classi (predefinite e custom)
      await contentAPI.updateGlobalCSS(cssClasses);
      setMessage({type: 'success', text: 'CSS globale salvato con successo!'});
      setActiveTab('content'); // Torna al contenuto dopo salvataggio
      updatePreview(); // Ricarica il CSS nella preview
      
      // Nascondi il messaggio dopo 3 secondi
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving global CSS:', error);
      setMessage({type: 'error', text: 'Errore durante il salvataggio del CSS globale. Riprova.'});
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // Pulisci gli stili di preview
    const oldStyle = globalThis.document?.getElementById(`${CSS_PREFIX}-preview-styles`);
    if (oldStyle) oldStyle.remove();
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.editorOverlay}>
      <div className={styles.editorContainer}>
        {/* Header con titolo e chiusura */}
        <div className={styles.editorHeader}>
          <h2>Modifica: {document.title}</h2>
          <button onClick={handleClose} className={styles.closeButton}>✕</button>
        </div>

        {/* Message Bar */}
        {message && (
          <div className={`${styles.messageBar} ${styles[message.type]}`}>
            <span>{message.text}</span>
            <button 
              onClick={() => setMessage(null)} 
              className={styles.messageClose}
            >
              ✕
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className={styles.toolbar}>
          {/* Classi Custom (prime) */}
          <div className={styles.toolbarSection}>
            <select 
              className={styles.classSelect}
              onChange={(e) => e.target.value && insertClass(e.target.value)}
              value=""
            >
              <option value="">Seleziona stile...</option>
              {cssClasses.filter(cls => cls.title.trim() && !cls.isPredefined && !cls.id.startsWith('color_')).map(cls => (
                <option key={cls.id} value={cls.title}>
                  {cls.title}
                </option>
              ))}
            </select>
          </div>

          {/* Formattazione Base */}
          <div className={styles.toolbarSection}>
            <button 
              onClick={() => showHTMLEditor ? insertFormattingInHTML('strong') : insertFormattingInPreview('strong')} 
              className={styles.toolButton}
            >
              <strong>B</strong>
            </button>
            <button 
              onClick={() => showHTMLEditor ? insertFormattingInHTML('em') : insertFormattingInPreview('em')} 
              className={styles.toolButton}
            >
              <em>I</em>
            </button>
            <button 
              onClick={() => showHTMLEditor ? insertFormattingInHTML('u') : insertFormattingInPreview('u')} 
              className={styles.toolButton}
            >
              <u>U</u>
            </button>
          </div>

          {/* Colori */}
          <div className={styles.toolbarSection} style={{ position: 'relative' }}>
            <button 
              onClick={() => {
                setShowULMenu(false);
                setShowIMGMenu(false);
                setShowLinkMenu(false);
                setShowTableMenu(false);
                setShowColorMenu(!showColorMenu);
              }} 
              className={styles.toolButton}
              title="Colori testo"
            >
              🎨
            </button>
            {showColorMenu && (
              <div className={styles.floatingMenu} style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                background: '#2a2a2a',
                border: '1px solid #d4af37',
                borderRadius: '8px',
                padding: '12px',
                zIndex: 1000,
                minWidth: '200px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
                  {cssClasses.filter(cls => cls.id.startsWith('color_')).map(color => (
                    <button 
                      key={color.id}
                      onClick={() => insertColor(color.title)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'none',
                        color: '#ffffff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#0d0d0d'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <span 
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          backgroundColor: color.css.match(/color:\s*([^;]+)/)?.[1] || '#000',
                          border: '1px solid #666'
                        }}
                      />
                      {color.title.charAt(0).toUpperCase() + color.title.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Allineamenti */}
          <div className={styles.toolbarSection}>
            <button onClick={() => insertAlignment('left')} className={styles.toolButton} title="Allinea a sinistra">←</button>
            <button onClick={() => insertAlignment('center')} className={styles.toolButton} title="Centra">≡</button>
            <button onClick={() => insertAlignment('right')} className={styles.toolButton} title="Allinea a destra">→</button>
            <button onClick={() => insertAlignment('justify')} className={styles.toolButton} title="Giustifica">☰</button>
          </div>

          {/* Elementi Speciali */}
          <div className={styles.toolbarSection} style={{ position: 'relative' }}>
            {/* UL con sottomenu */}
            <button 
              onClick={() => {
                setShowIMGMenu(false);
                setShowLinkMenu(false);
                setShowTableMenu(false);
                setShowColorMenu(false);
                setShowULMenu(!showULMenu);
              }} 
              className={styles.toolButton}
            >
              UL ▼
            </button>
            {showULMenu && (
              <div className={styles.floatingMenu} style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                background: '#2a2a2a',
                border: '1px solid #d4af37',
                borderRadius: '8px',
                padding: '8px',
                zIndex: 1000,
                minWidth: '160px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                <button onClick={() => insertListType('ul')} style={{
                  display: 'block', 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: 'none', 
                  background: 'none', 
                  color: '#ffffff',
                  textAlign: 'left',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }} onMouseEnter={(e) => e.currentTarget.style.background = '#0d0d0d'} onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>• Lista puntata</button>
                <button onClick={() => insertListType('ol')} style={{
                  display: 'block', 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: 'none', 
                  background: 'none', 
                  color: '#ffffff',
                  textAlign: 'left',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }} onMouseEnter={(e) => e.currentTarget.style.background = '#0d0d0d'} onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>1. Lista numerata</button>
              </div>
            )}
            
            {/* IMG con sottomenu */}
            <button 
              onClick={() => {
                setShowLinkMenu(false);
                setShowTableMenu(false);
                setShowULMenu(false);
                setShowColorMenu(false);
                setShowIMGMenu(!showIMGMenu);
              }} 
              className={styles.toolButton}
            >
              IMG ▼
            </button>
            {showIMGMenu && (
              <div className={styles.floatingMenu} style={{
                position: 'absolute',
                top: '100%',
                left: '60px',
                background: '#2a2a2a',
                border: '1px solid #d4af37',
                borderRadius: '8px',
                padding: '16px',
                zIndex: 1000,
                minWidth: '250px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                <div style={{marginBottom: '12px'}}>
                  <label style={{display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#ffffff'}}>URL Immagine</label>
                  <input 
                    type="text" 
                    placeholder="https://esempio.com/immagine.jpg" 
                    id="img-url" 
                    style={{
                      width: '100%', 
                      padding: '8px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      fontSize: '14px'
                    }} 
                  />
                </div>
                <div style={{marginBottom: '16px'}}>
                  <label style={{display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#ffffff'}}>Descrizione (Alt Text)</label>
                  <input 
                    type="text" 
                    placeholder="Descrizione dell'immagine" 
                    id="img-alt" 
                    style={{
                      width: '100%', 
                      padding: '8px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      fontSize: '14px'
                    }} 
                  />
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <button onClick={() => {
                    const urlInput = globalThis.document?.getElementById('img-url') as HTMLInputElement;
                    const altInput = globalThis.document?.getElementById('img-alt') as HTMLInputElement;
                    if (urlInput?.value) {
                      insertImage(urlInput.value, altInput?.value || 'Immagine');
                    }
                  }} style={{
                    background: '#28a745', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>Inserisci</button>
                  <button onClick={() => setShowIMGMenu(false)} style={{
                    background: '#6c757d', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}>Annulla</button>
                </div>
              </div>
            )}
            
            {/* LINK con sottomenu */}
            <button 
              onClick={() => {
                setShowIMGMenu(false);
                setShowTableMenu(false);
                setShowULMenu(false);
                setShowColorMenu(false);
                setShowLinkMenu(!showLinkMenu);
              }} 
              className={styles.toolButton}
            >
              🔗
            </button>
            {showLinkMenu && (
              <div className={styles.floatingMenu} style={{
                position: 'absolute',
                top: '100%',
                left: '120px',
                background: '#2a2a2a',
                border: '1px solid #d4af37',
                borderRadius: '8px',
                padding: '16px',
                zIndex: 1000,
                minWidth: '250px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                <div style={{marginBottom: '12px'}}>
                  <label style={{display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#ffffff'}}>URL Link</label>
                  <input 
                    type="text" 
                    placeholder="https://esempio.com" 
                    id="link-url" 
                    style={{
                      width: '100%', 
                      padding: '8px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      fontSize: '14px'
                    }} 
                  />
                </div>
                <div style={{marginBottom: '16px'}}>
                  <label style={{display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#ffffff'}}>Testo Link</label>
                  <input 
                    type="text" 
                    placeholder="Testo del collegamento" 
                    id="link-text" 
                    style={{
                      width: '100%', 
                      padding: '8px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      fontSize: '14px'
                    }} 
                  />
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <button onClick={() => {
                    const urlInput = globalThis.document?.getElementById('link-url') as HTMLInputElement;
                    const textInput = globalThis.document?.getElementById('link-text') as HTMLInputElement;
                    const url = urlInput?.value?.trim();
                    const text = textInput?.value?.trim();
                    
                    console.log('Link button clicked:', { url, text });

                    if (!url) {
                      showToast('Inserisci un URL valido', 'error');
                      return;
                    }

                    insertLink(url, text || 'Link');
                  }} style={{
                    background: '#007bff', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>Inserisci</button>
                  <button onClick={() => setShowLinkMenu(false)} style={{
                    background: '#6c757d', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}>Annulla</button>
                </div>
              </div>
            )}
            
            {/* TABELLE con sottomenu */}
            <button 
              onClick={() => {
                setShowIMGMenu(false);
                setShowLinkMenu(false);
                setShowULMenu(false);
                setShowColorMenu(false);
                setShowTableMenu(!showTableMenu);
              }} 
              className={styles.toolButton}
            >
              📊
            </button>
            {showTableMenu && (
              <div className={styles.floatingMenu} style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                background: '#2a2a2a',
                border: '1px solid #d4af37',
                borderRadius: '8px',
                padding: '16px',
                zIndex: 1000,
                minWidth: '220px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                <div style={{marginBottom: '12px'}}>
                  <label style={{display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#ffffff'}}>Numero di Righe</label>
                  <input 
                    type="number" 
                    placeholder="3" 
                    id="table-rows" 
                    min="1" 
                    max="20" 
                    defaultValue="3" 
                    style={{
                      width: '100%', 
                      padding: '8px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      fontSize: '14px'
                    }} 
                  />
                </div>
                <div style={{marginBottom: '16px'}}>
                  <label style={{display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#ffffff'}}>Numero di Colonne</label>
                  <input 
                    type="number" 
                    placeholder="3" 
                    id="table-cols" 
                    min="1" 
                    max="10" 
                    defaultValue="3" 
                    style={{
                      width: '100%', 
                      padding: '8px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      fontSize: '14px'
                    }} 
                  />
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <button onClick={() => {
                    const rowsInput = globalThis.document?.getElementById('table-rows') as HTMLInputElement;
                    const colsInput = globalThis.document?.getElementById('table-cols') as HTMLInputElement;
                    const rows = parseInt(rowsInput?.value || '3');
                    const cols = parseInt(colsInput?.value || '3');
                    insertTable(rows, cols);
                  }} style={{
                    background: '#17a2b8', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>Inserisci</button>
                  <button onClick={() => setShowTableMenu(false)} style={{
                    background: '#6c757d', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}>Annulla</button>
                </div>
              </div>
            )}
          </div>

          {/* Modalità Editor */}
          <div className={styles.toolbarSection}>
            <span className={styles.sectionLabel}>MODALITÀ</span>
            <button 
              className={`${styles.tabButton} ${!showHTMLEditor && activeTab === 'content' ? styles.active : ''}`}
              onClick={() => {setShowHTMLEditor(false); setActiveTab('content');}}
            >
              ✏️ EDITABILE
            </button>
            <button 
              className={`${styles.tabButton} ${showHTMLEditor && activeTab === 'content' ? styles.active : ''}`}
              onClick={() => {setShowHTMLEditor(true); setActiveTab('content');}}
            >
              📝 HTML
            </button>
            <button 
              className={`${styles.tabButton} ${activeTab === 'css' ? styles.active : ''}`}
              onClick={() => {setActiveTab('css'); setShowHTMLEditor(false);}}
            >
              🎨 CSS
            </button>
          </div>
        </div>

        {/* Fixed Save Button - in basso a destra */}
        <button 
          className={styles.saveButtonFixed}
          onClick={activeTab === 'css' ? handleSaveCSS : handleSave}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            backgroundColor: activeTab === 'css' ? '#007bff' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            minWidth: '120px'
          }}
          disabled={loading}
        >
          {loading ? 'Salvando...' : (activeTab === 'css' ? '💾 SALVA CSS' : '💾 SALVA')}
        </button>

        {/* Main Content */}
        <div className={styles.mainContent}>
          {/* Left Panel - Editor (HTML o CSS) - mostra quando showHTMLEditor = true o activeTab = css */}
          {(showHTMLEditor || activeTab === 'css') && (
            <div className={styles.editorPanel} style={{
              position: (showHTMLEditor || activeTab === 'css') ? 'unset' : 'static',
              left: (showHTMLEditor || activeTab === 'css') ? 'unset' : '0',
              top: 'unset',
              width: '50%',
              height: '100%',
              backgroundColor: 'var(--bg-primary)',
              borderRight: '1px solid var(--border-color)',
              zIndex: 999,
              overflow: 'auto'
            }}>
              {showHTMLEditor ? (
                // Editor HTML
                <div className={styles.contentEditor}>
                  <div className={styles.editorInfo}>
                    Editor HTML - Prefisso CSS: <code>{CSS_PREFIX}__</code>
                  </div>
                  <textarea
                    id="content-editor"
                    className={styles.codeEditor}
                    value={content}
                    onChange={(e) => syncFromHTMLEditor(e.target.value)}
                    placeholder="Inserisci qui il contenuto del documento usando HTML..."
                    style={{ height: 'calc(100vh - 200px)' }}
                  />
                </div>
              ) : (
                // Editor CSS
                <div className={styles.cssEditor} style={{ padding: '20px' }}>
                  <div className={styles.editorInfo} style={{ marginBottom: '20px' }}>
                    Editor CSS Globale - Le classi verranno prefissate con <code>{CSS_PREFIX}__</code>
                  </div>
                  <div className={styles.cssClassesList} style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                    {/* Sezione Colori */}
                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{ color: '#d4af37', marginBottom: '15px', fontSize: '18px', fontWeight: 'bold' }}>🎨 Colori</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '15px' }}>
                        {cssClasses.filter(cls => cls.id.startsWith('color_')).map((cssClass) => (
                          <div key={cssClass.id} className={`${styles.cssClassForm} ${styles.colorClass}`} style={{ 
                            background: '#f8f5f0', 
                            border: '2px solid #d4af37',
                            borderRadius: '8px',
                            padding: '12px',
                            minHeight: '120px',
                            display: 'flex',
                            flexDirection: 'column'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                              <span 
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  backgroundColor: cssClass.css.match(/color:\s*([^;]+)/)?.[1] || '#000',
                                  border: '1px solid #666',
                                  flexShrink: 0
                                }}
                              />
                              <input
                                type="text"
                                placeholder="Nome colore"
                                value={cssClass.title}
                                onChange={(e) => updateCSSClass(cssClass.id, 'title', e.target.value)}
                                style={{ 
                                  flex: 1, 
                                  padding: '6px 8px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '14px',
                                  fontWeight: 'bold'
                                }}
                              />
                              <button 
                                onClick={() => removeCSSClass(cssClass.id)}
                                style={{
                                  background: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                            <textarea
                              placeholder="color: #d4af37;"
                              value={cssClass.css}
                              onChange={(e) => updateCSSClass(cssClass.id, 'css', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                resize: 'none',
                                flex: 1,
                                minHeight: '50px'
                              }}
                              rows={2}
                            />
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={() => {
                          const newColor: CSSClass = {
                            id: `color_${Date.now()}`,
                            title: 'nuovo-colore',
                            css: 'color: #000000;',
                            htmlElement: 'span'
                          };
                          setCssClasses(prev => [...prev, newColor]);
                        }}
                        style={{
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '10px 16px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          marginTop: '15px'
                        }}
                      >
                        + Nuovo Colore
                      </button>
                    </div>

                    {/* Sezione Classi Custom */}
                    <div>
                      <h3 style={{ color: '#d4af37', marginBottom: '15px', fontSize: '18px', fontWeight: 'bold' }}>📝 Classi Custom</h3>
                      {cssClasses.filter(cls => !cls.isPredefined && !cls.id.startsWith('color_')).map((cssClass, index) => (
                      <div key={cssClass.id} className={`${styles.cssClassForm} ${cssClass.isPredefined ? styles.predefined : ''}`}>
                        <div className={styles.cssClassHeader}>
                          {cssClass.isPredefined && (
                            <span className={styles.predefinedLabel}>PREDEFINITA</span>
                          )}
                          <input
                            type="text"
                            placeholder="Titolo classe"
                            value={cssClass.title}
                            onChange={(e) => updateCSSClass(cssClass.id, 'title', e.target.value)}
                            className={`${styles.classTitleInput} ${cssClass.isPredefined ? styles.readonly : ''}`}
                            readOnly={cssClass.isPredefined}
                          />
                          <input
                            type="text"
                            placeholder="Elemento HTML (es: div, span, h2)"
                            value={cssClass.htmlElement}
                            onChange={(e) => updateCSSClass(cssClass.id, 'htmlElement', e.target.value)}
                            className={`${styles.classElementInput} ${cssClass.isPredefined ? styles.readonly : ''}`}
                            readOnly={cssClass.isPredefined}
                          />
                          {!cssClass.isPredefined && (
                            <button 
                              onClick={() => removeCSSClass(cssClass.id)}
                              className={styles.removeClassButton}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                        <textarea
                          placeholder="color: #d4af37;&#10;font-size: 24px;&#10;text-align: center;"
                          value={cssClass.css}
                          onChange={(e) => updateCSSClass(cssClass.id, 'css', e.target.value)}
                          className={styles.cssTextarea}
                          rows={4}
                        />
                      </div>
                    ))}
                    
                      <button 
                        onClick={addNewCSSClass}
                        className={styles.addClassButton}
                      >
                        + Nuova Classe CSS
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview Panel - sempre visibile */}
          <div className={styles.previewPanel} style={{
            width: (showHTMLEditor || activeTab === 'css') ? '50%' : '100%',
            transition: 'margin-left 0.3s ease, width 0.3s ease'
          }}>
            <div className={styles.previewHeader}>
              {(showHTMLEditor || activeTab === 'css') ? 'Anteprima Live' : 'Editor Visuale'}
              <span className={styles.previewInfo}>
                {(showHTMLEditor || activeTab === 'css') ? 'Aggiornamento automatico' : 'Clicca per editare direttamente'}
              </span>
            </div>
            <div 
              ref={previewRef}
              className={`${styles.preview} ${(!showHTMLEditor && activeTab !== 'css') ? styles.editable : ''}`}
              contentEditable={!showHTMLEditor && activeTab !== 'css'}
              onBlur={handlePreviewBlur}
              suppressContentEditableWarning={true}
              style={{
                minHeight: '400px',
                height: (showHTMLEditor || activeTab === 'css') ? 'calc(100vh - 200px)' : 'auto',
                border: (!showHTMLEditor && activeTab !== 'css') ? '2px dashed #ccc' : '1px solid var(--border-color)',
                outline: 'none',
                padding: '15px',
                backgroundColor: '#c0bfa8'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}