// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { BookmarksLiteViewProvider } from './BookmarksLiteViewProvider';
import { GlobalStatus, bookmarkInfo } from './GlobalStatus';

/*
[extension.ts]
- Core de la extensión. exporta una función "activate" y "deactivate"
- inicializa: 
    - Crea los "textEditorDecorationType" con los iconos y colores en la barra de scroll
    - Crea un GlobalStatus
    - pinta las deco del fich actual
- Registra los COMANDOS, algunos publicos y otros internos
    Estos comandos actuan sobre gs, sobre vscode.window.activeTextEditor, vscode.window, vsbprovider, etc;
- Registra manejadores de EVENTOS
    al cambiar de ventana activa, actualizar los deco, al editar actualiza los bookmark, al cambiar de nombre o borrar un fichero, etc
- Crea un vsbprovider =  new BookmarksLiteViewProvider()
*/


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // INIT ------------------------------------------------------------------------------------------------------------ 

    // Creamos los tipos de decoraciones
    let bookmarkDecoType1 = vscode.window.createTextEditorDecorationType({ // Bookmark amarillo
        gutterIconPath: context.asAbsolutePath('img\\bookmarkicon1.svg').split('\\').join('/'),
        gutterIconSize: 'contain',
        overviewRulerLane: vscode.OverviewRulerLane.Left,
        overviewRulerColor: 'rgba(240, 199, 0, 0.7)',
    });
    let bookmarkDecoType2 = vscode.window.createTextEditorDecorationType({ // Estrella amarilla
        gutterIconPath: context.asAbsolutePath('img\\bookmarkicon2.svg').split('\\').join('/'),
        gutterIconSize: 'contain',
        overviewRulerLane: vscode.OverviewRulerLane.Left,
        overviewRulerColor: 'rgba(240, 199, 0, 0.7)',
    });
    let bookmarkDecoType3 = vscode.window.createTextEditorDecorationType({ // Corazon rojo
        gutterIconPath: context.asAbsolutePath('img\\bookmarkicon3.svg').split('\\').join('/'),
        gutterIconSize: 'contain',
        overviewRulerLane: vscode.OverviewRulerLane.Left,
        overviewRulerColor: 'rgba(240, 199, 0, 0.7)',
    });
    // Creamos el objeto que guarda el estado global
    const gs = new GlobalStatus(context);
    // Actualizamos las decoraciones por primera vez
    updateLineDecorations();


    // COMMANDS ------------------------------------------------------------------------------------------------------------ 
    
    let disposable: vscode.Disposable;

    // toggle: Creamos / eliminamos un bookmark (con un comando que se asociará a una tecla también) 
    disposable = vscode.commands.registerCommand('bookmarks-lite.toggle', () => {
        if (vscode.window.activeTextEditor?.selection) {
            const filename = vscode.window.activeTextEditor.document.fileName;
            const line = vscode.window.activeTextEditor.selection.anchor.line;
            // gs.toggleBookmark(filename, line);
            // selectFocusedInViewList(); // toggle cambia el foco y hay que reflejarlo en la lista
            toggleBookmark(filename, line);
        }    
        // updateLineDecorations();
        // updateViewList();
	});
    context.subscriptions.push(disposable);

    // next
    disposable = vscode.commands.registerCommand('bookmarks-lite.next', () => {
        showListIfAutoShow();
        gs.focusNext();
        const bookmark = gs.getFocusedBookmark();
        openBookmarkDocument(bookmark);
        selectFocusedInViewList();
    });
    context.subscriptions.push(disposable);

    // Prev
    disposable = vscode.commands.registerCommand('bookmarks-lite.prev', () => {
        showListIfAutoShow();
        gs.focusPrev();
        const bookmark = gs.getFocusedBookmark();
        openBookmarkDocument(bookmark);
        selectFocusedInViewList();
    });
    context.subscriptions.push(disposable);    

    // show
    disposable = vscode.commands.registerCommand('bookmarks-lite.show', (index: number) => {
        showListIfAutoShow();
        // Abre el documento de ese bookmark y manda el cursor a donde toca
        gs.setFocus(index);
        const bookmark = gs.getFocusedBookmark();
        openBookmarkDocument(bookmark);
        updateViewList();
        selectFocusedInViewList();
        /*gs.toggleBookmark(fsPath, lineNumber);
        updateLineDecorations();
        updateViewList();
        selectFocusedInViewList(); // toggle cambia el foco y hay que reflejarlo en la lista*/

    });
    context.subscriptions.push(disposable);

    // Delete (file, line)
    disposable = vscode.commands.registerCommand('bookmarks-lite.deleteone', (filename: string, line: number) => {
        toggleBookmark(filename, line);
    });
    context.subscriptions.push(disposable);

    // Delete (selected en list)
    disposable = vscode.commands.registerCommand('bookmarks-lite.deleteselected', () => {
        const deleteaction = () => {
            showListIfAutoShow();
            gs.deleteSelectedAndUpdateSelection();
            updateLineDecorations();
            updateViewList();
        };
        const selected = gs.getSelected();
        if (selected && selected.length > 1) {
            vscode.window.showInformationMessage("Are you sure you want to delete the ("+selected.length+") selected bookmarks?", "Yes", "No").then(answer => {
              if (answer === "Yes") {
                deleteaction();
              }
            });            
        } else if (selected && selected.length === 1) {
            deleteaction();
        } else {
            vscode.window.showInformationMessage("Select a bookmark from the list and click this button to delete it");
        }
    });
    context.subscriptions.push(disposable);    
    disposable = vscode.commands.registerCommand('bookmarks-lite.contextual.deletebookmark', (contextualInfo) => {
        /*gs.toggleBookmark(contextualInfo.data.filename, contextualInfo.data.line);
        updateLineDecorations();
        updateViewList();*/
        toggleBookmark(contextualInfo.data.filename, contextualInfo.data.line);
    });
    context.subscriptions.push(disposable);

    // DOC: acerca de los comandos contextuales: donde se puede contribuir? https://code.visualstudio.com/api/references/contribution-points

    // linetoggle: Contextual desde el numero de linea
    disposable = vscode.commands.registerCommand('bookmarks-lite.contextual.linetoggle', (contextualInfo) => {
        let fsPath = contextualInfo.uri.fsPath; // https://code.visualstudio.com/api/references/vscode-api#Uri
        let lineNumber = contextualInfo.lineNumber-1;
        toggleBookmark(fsPath, lineNumber);
    });
    context.subscriptions.push(disposable);

    // showList: Contextual desde el numero de linea
    disposable = vscode.commands.registerCommand('bookmarks-lite.contextual.showList', (contextualInfo) => {
        vscode.commands.executeCommand('bookmarks-lite.list.focus');
    });
    context.subscriptions.push(disposable);      

    // Go to bookmark: Contextual desde el numero de linea
    disposable = vscode.commands.registerCommand('bookmarks-lite.contextual.gotobookmark', (contextualInfo) => {
        showListIfAutoShow();
        gs.setFocus( gs.getIndexOf(contextualInfo.data.filename, contextualInfo.data.line) );
        const bookmark = gs.getFocusedBookmark();
        openBookmarkDocument(bookmark);
        selectFocusedInViewList();
    });
    context.subscriptions.push(disposable);

    // Actualize icon (establece icono y actualiza decoraciones)
    disposable = vscode.commands.registerCommand('bookmarks-lite.actualizeicon', (contextualInfo) => {
        gs.setSelectedIcon(contextualInfo);
        updateLineDecorations();
    });
    context.subscriptions.push(disposable);    



    // VISTAS  ------------------------------------------------------------------------------------------------------------ --------------------------------- 
    const vsbprovider = new BookmarksLiteViewProvider(context.extensionUri, gs);
    const subscr = context.subscriptions.push(vscode.window.registerWebviewViewProvider('bookmarks-lite.list', vsbprovider));
    // TODO: subscr ¿?

    // EVENTOS ------------------------------------------------------------------------------------------------------------ --------------------------------- 

    // EVENTO: Al cambiar de fichero activo
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        updateLineDecorations();
    }));

    // EVENTO: al EDITAR 
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
        // Confirmar si estamos en el fichero activo y confirmar si el fichero activo tiene bookmarks
        // https://code.visualstudio.com/api/references/vscode-api#TextDocumentContentChangeEvent
        // const docLineLength1  = event.document.lineAt(16).range.end.character;

        const fileName = event.document.fileName;
        const bookmarksOfFile = gs.getBookmarksOfFile(fileName);
        if (event.contentChanges && bookmarksOfFile && bookmarksOfFile.length > 0) {
            event.contentChanges.forEach( change => {
                const initiaLineNumber = change.range.start.line;
                const finalLineNumber = change.range.end.line;
                const oldLines = finalLineNumber - initiaLineNumber;
                const newLines = change.text.split('\n').length - 1;
                const lineNumberChange = newLines - oldLines;
                const initchar = change.range.start.character;
                const endchar = change.range.end.character;
                bookmarksOfFile.forEach((bookmark:bookmarkInfo) => {
                    if (finalLineNumber < bookmark.line){ // Si FIN antes de la linea
                        bookmark.line += lineNumberChange; // --> movemos
                    } else if (initiaLineNumber < bookmark.line) { // Si INICIO antes de la linea ...
                        if (finalLineNumber > bookmark.line) { // Si INICIO antes de la linea y FIN despues
                            // gs.toggleBookmark(fileName, bookmark.line); // --> eliminamos bookmark
                            toggleBookmark(fileName, bookmark.line);
                            vscode.window.showInformationMessage('Bookmark lost.');
                        } else if ( finalLineNumber === bookmark.line ) { // Si INICIO antes de la linea y FIN DENTRO ...
                            if (endchar === 0) { // Si el rango acaba en el ppo ...
                                bookmark.line += lineNumberChange; // --> movemos
                            } else {
                                // gs.toggleBookmark(fileName, bookmark.line); // --> eliminamos bookmark
                                toggleBookmark(fileName, bookmark.line);
                                vscode.window.showInformationMessage('Bookmark lost.');
                            }
                            // MEJORA: ... (si rango cogía toda la linea) --> eliminamos , en el resto de casos muevo
                        }
                    } else if (initiaLineNumber === bookmark.line && finalLineNumber > bookmark.line && initchar === 0) { // Si INICIO DENTRO (y inicio de rango en el inicio de la linea) y FIN DEBAJO ...
                        // gs.toggleBookmark(fileName, bookmark.line); // --> eliminamos bookmark
                        toggleBookmark(fileName, bookmark.line);
                        vscode.window.showInformationMessage('Bookmark lost.');
                    } else if (initiaLineNumber === bookmark.line && finalLineNumber === bookmark.line) { // SI inicio y final DENTRO 
                        if (initchar === 0) {
                            bookmark.line += lineNumberChange; // --> movemos
                        }
                        // MEJORA: (si desde inicio hasta final) --> eliminamos
                    }
                });
                updateLineDecorations();
                updateViewList();
            });
        }
    }));    

    // EVENTO: al CAMBIAR EL NOMBRE DE UN DOC
    context.subscriptions.push(vscode.workspace.onDidRenameFiles((event) => {
        if (event.files) {
            event.files.forEach(file => { gs.onRenameFile(file); }); 
        }
        updateLineDecorations();
        updateViewList();
    }));

    // EVENTO: Al BORRAR
    context.subscriptions.push(vscode.workspace.onDidDeleteFiles((event) => {
        if (event.files) {
            event.files.forEach(file => { gs.onDeleteFile(file); }); 
        }
        updateLineDecorations();
        updateViewList();
    }));           


    
    // MÉTODOS USADOS POR LOS EVENTOS Y LOS COMANDOS ----------------------------------------------------------------------------------------------------

    function showListIfAutoShow() {
        if (gs.getShowListOnAction()) {
            vsbprovider.openView();
            // vscode.commands.executeCommand('bookmarks-lite.list.focus'); // No porque esto manda el foco
        }
    }

    function updateLineDecorations() {
        const activeTextEditor = vscode.window.activeTextEditor;
        if (activeTextEditor) {
            const bookmarkedLines = gs.getBookmarkedLinesOfFile( activeTextEditor.document.fileName );
            const ranges = bookmarkedLines.map((line:number) => new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, 0)));
            const selectedIcon = gs.getSelectedIcon();
            const newDeco = selectedIcon === 3 ? bookmarkDecoType3 :
                (selectedIcon === 2 ? bookmarkDecoType2 : bookmarkDecoType1);
            // Limpiamos las decoraciones y reasignamos
            activeTextEditor.setDecorations(bookmarkDecoType1, []);
            activeTextEditor.setDecorations(bookmarkDecoType2, []);
            activeTextEditor.setDecorations(bookmarkDecoType3, []);
            activeTextEditor.setDecorations(newDeco, ranges);
        }
    }

    function updateViewList() {
        vsbprovider.updateList(gs);
    }

    function selectFocusedInViewList() {
        vsbprovider.selectFocused();
    }    

    function openBookmarkDocument(bookmark: bookmarkInfo) {
        vscode.workspace.openTextDocument(bookmark.filename).then(doc => {
            // https://code.visualstudio.com/api/references/vscode-api
            vscode.window.showTextDocument(doc, {
                preview: true,
                selection: new vscode.Range(bookmark.line, 0, bookmark.line, 0),
                preserveFocus: true
                // viewcolumn ¿?
            }).then( item => {
                updateLineDecorations();
            });
        }, err => {
            vscode.window.showInformationMessage('Unable to navigate to Bookmark (\''+bookmark.name+'\'). File was not found.');
        });
    }

    function toggleBookmark(fsPath: string, lineNumber: number) {
        showListIfAutoShow();
        gs.toggleBookmark(fsPath, lineNumber);
        updateLineDecorations();
        updateViewList();
        selectFocusedInViewList(); // toggle cambia el foco y hay que reflejarlo en la lista
    }

}

// This method is called when your extension is deactivated
export function deactivate() {}

/*
    DOC: 
        // Sobre el global storage :: https://code.visualstudio.com/api/extension-capabilities/common-capabilities
        // Sobre como meter keybindings https://code.visualstudio.com/api/references/contribution-points#contributes.keybindings
        // Sobre webviews https://code.visualstudio.com/api/references/vscode-api#WebviewViewProvider
        //   ojo ejemplo  https://github.com/microsoft/vscode-extension-samples/blob/main/webview-view-sample/src/extension.ts
        // API :   https://code.visualstudio.com/api/references/vscode-api#scm
        //         https://code.visualstudio.com/api/references/activation-events

    // DOC: deco render options : https://code.visualstudio.com/api/references/vscode-api#DecorationRenderOptions
        // DOC: Los colores: https://code.visualstudio.com/api/references/theme-color
        /*
        // DOC: Para el icono https://github.com/microsoft/vscode-extension-samples/blob/main/decorator-sample/USAGE.md
            // https://stackoverflow.com/questions/62375509/setting-icons-before-line-number-in-vscode
            // https://code.visualstudio.com/api/references/vscode-api
            // https://github.com/alefragnani/vscode-bookmarks/blob/master/src/extension.ts
            // https://github.com/microsoft/vscode/issues/12111
            
*/