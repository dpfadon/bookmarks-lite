// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GlobalStatus, bookmarkInfo, bookmarkState } from './globalstatus';
import { BookmarksLiteViewProvider } from './webview';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // ---------------------------------
    // TIPS: 
	// console.log('Congratulations, ...!');

    // ---------------------------------
    //
    // DOC: deco render options : https://code.visualstudio.com/api/references/vscode-api#DecorationRenderOptions
    // DOC: Los colores: https://code.visualstudio.com/api/references/theme-color

    let bookmarkDecoType1 = vscode.window.createTextEditorDecorationType({
        gutterIconPath: context.asAbsolutePath('img\\bookmarkicon1.svg').split('\\').join('/'),
        gutterIconSize: 'contain',
        overviewRulerLane: vscode.OverviewRulerLane.Left,
        overviewRulerColor: 'rgba(240, 199, 0, 0.7)',
    });
    let bookmarkDecoType2 = vscode.window.createTextEditorDecorationType({
        gutterIconPath: context.asAbsolutePath('img\\bookmarkicon2.svg').split('\\').join('/'),
        gutterIconSize: 'contain',
        overviewRulerLane: vscode.OverviewRulerLane.Left,
        overviewRulerColor: 'rgba(240, 199, 0, 0.7)',
    });

    const gs = new GlobalStatus(context);

    // gs.setState(new bookmarkState()); // Descomentando esto reseteamos la extensión

    // COMMANDS ---------------------- ---------------------- ---------------------- ---------------------- 
    
    let disposable: vscode.Disposable;

    // toggle: Creamos / eliminamos un bookmark (con un comando que se asociará a una tecla también) 
    disposable = vscode.commands.registerCommand('bookmarks-lite.toggle', () => {
        if (vscode.window.activeTextEditor?.selection) {
            const filename = vscode.window.activeTextEditor.document.fileName;
            const line = vscode.window.activeTextEditor.selection.anchor.line;
            gs.toggleBookmark(filename, line);
        }    
        updateLineDecorations();
        updateViewList();
	});
    context.subscriptions.push(disposable);

    // next
    disposable = vscode.commands.registerCommand('bookmarks-lite.next', () => {
        gs.focusNext();
        const bookmark = gs.getFocusedBookmark();
        openBookmarkDocument(bookmark);
        selectFocusedInViewList();
    });
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('bookmarks-lite.prev', () => {
        gs.focusPrev();
        const bookmark = gs.getFocusedBookmark();
        openBookmarkDocument(bookmark);
        selectFocusedInViewList();
    });
    context.subscriptions.push(disposable);    

    // show
    disposable = vscode.commands.registerCommand('bookmarks-lite.show', (index: number) => {
        // Abre el documento de ese bookmark y manda el cursor a donde toca
        gs.setFocus(index);
        const bookmark = gs.getFocusedBookmark();
        openBookmarkDocument(bookmark);
    });
    context.subscriptions.push(disposable);

    // Delete (file, line)
    disposable = vscode.commands.registerCommand('bookmarks-lite.deleteone', (filename: string, line: number) => {
        gs.toggleBookmark(filename, line);
        updateLineDecorations();
        updateViewList();
    });
    context.subscriptions.push(disposable);

    // Delete (selected en list)
    disposable = vscode.commands.registerCommand('bookmarks-lite.deleteselected', () => {
        const deleteaction = () => {
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
        gs.toggleBookmark(contextualInfo.data.filename, contextualInfo.data.line);
        updateLineDecorations();
        updateViewList();
    });
    context.subscriptions.push(disposable);

    // Contextual desde el numero de linea
    disposable = vscode.commands.registerCommand('bookmarks-lite.contextual.linetoggle', (contextualInfo,xx,yy) => {
        let fsPath = contextualInfo.uri.fsPath; // https://code.visualstudio.com/api/references/vscode-api#Uri
        let lineNumber = contextualInfo.lineNumber-1;
        gs.toggleBookmark(fsPath, lineNumber);
        updateLineDecorations();
        updateViewList();
    });
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('bookmarks-lite.contextual.showList', (contextualInfo) => {
        vscode.commands.executeCommand('bookmarks-lite.list.focus');
        setTimeout(()=>{
            // TODO:
        },100);
    });
    context.subscriptions.push(disposable);      

    // Go to bookmark
    disposable = vscode.commands.registerCommand('bookmarks-lite.contextual.gotobookmark', (contextualInfo) => {
        gs.setFocus( gs.getIndexOf(contextualInfo.data.filename, contextualInfo.data.line) );
        const bookmark = gs.getFocusedBookmark();
        openBookmarkDocument(bookmark);
        selectFocusedInViewList();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('bookmarks-lite.actualizeicon', (contextualInfo) => {
        gs.setSelectedIcon(contextualInfo);
        updateLineDecorations();
    });
    context.subscriptions.push(disposable);    

    // VISTAS ----------------------------------------------------------------------------------
    const vsbprovider = new BookmarksLiteViewProvider(context.extensionUri, gs);
    const subscr = context.subscriptions.push(vscode.window.registerWebviewViewProvider('bookmarks-lite.list', vsbprovider));

    // EVENTOS ------------------------------------------------------------------------------------------------------------

    // Al cambiar de fichero activo
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        // console.log("Active Editor Changed: " + editor?.document.fileName);
        updateLineDecorations();
    }));

    // EVENTO al EDITAR 
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
                            gs.toggleBookmark(fileName, bookmark.line); // --> eliminamos bookmark
                            vscode.window.showInformationMessage('Bookmark lost.');
                        } else if ( finalLineNumber === bookmark.line ) { // Si INICIO antes de la linea y FIN DENTRO ...
                            if (endchar === 0) { // Si el rango acaba en el ppo ...
                                bookmark.line += lineNumberChange; // --> movemos
                            } else {
                                gs.toggleBookmark(fileName, bookmark.line); // --> eliminamos bookmark
                                vscode.window.showInformationMessage('Bookmark lost.');
                            }
                            // MEJORA: ... (si rango cogía toda la linea) --> eliminamos , en el resto de casos muevo
                        }
                    } else if (initiaLineNumber === bookmark.line && finalLineNumber > bookmark.line && initchar === 0) { // Si INICIO DENTRO (y inicio de rango en el inicio de la linea) y FIN DEBAJO ...
                        gs.toggleBookmark(fileName, bookmark.line); // --> eliminamos bookmark
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

    // EVENTO al CAMBIAR EL NOMBRE DE UN DOC
    context.subscriptions.push(vscode.workspace.onDidRenameFiles((event) => {
        if (event.files) {
            event.files.forEach(file => { gs.onRenameFile(file); }); 
        }
        updateLineDecorations();
        updateViewList();
    }));

    // Al borrar
    context.subscriptions.push(vscode.workspace.onDidDeleteFiles((event) => {
        if (event.files) {
            event.files.forEach(file => { gs.onDeleteFile(file); }); 
        }
        updateLineDecorations();
        updateViewList();
    }));           


    // ----------------------------------------------------------------------------------------------------

    updateLineDecorations(); // Ponemos las decoraciones por primera vez

    // ----------------------------------------------------------------------------------------------------

    function updateLineDecorations() {
        const activeTextEditor = vscode.window.activeTextEditor;
        if (activeTextEditor) {
            const bookmarkedLines = gs.getBookmarkedLinesOfFile( activeTextEditor.document.fileName );
            const ranges = bookmarkedLines.map((line:number) => new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, 0)));
            const selectedIcon = gs.getSelectedIcon();
            const newDeco = selectedIcon === 2 ? bookmarkDecoType2 : bookmarkDecoType1;
            // Limpiamos las decoraciones y reasignamos
            activeTextEditor.setDecorations(bookmarkDecoType1, []);
            activeTextEditor.setDecorations(bookmarkDecoType2, []);
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
            vscode.window.showTextDocument(doc, {
                preview: true,
                selection: new vscode.Range(bookmark.line, 0, bookmark.line, 0)
                // viewcolumn ¿?
            }).then( item => {
                updateLineDecorations();
            });
        }, err => {
            vscode.window.showInformationMessage('Unable to navigate to Bookmark (\''+bookmark.name+'\'). File was not found.');
        });
    }

    /*function XXXBORRARYYY(bookmark: bookmarkInfo) {
        vscode.workspace.openTextDocument(bookmark.filename).then(doc => {
            vscode.window.showTextDocument(doc, {
                preview: true,
                selection: new vscode.Range(bookmark.line, 0, bookmark.line, 0)
                // viewcolumn ¿?
            }).then( item => {
                updateLineDecorations();
            });
        }, err => {
            vscode.window.showInformationMessage('Unable to navigate to Bookmark (\''+bookmark.name+'\'). File was not found.');
        });
    }*/

    // ---------------------------------

        // Navegamos entre bookmarks (ir al siguiente / anterior) 
    // Comando para listar los bookmarks ¿?
    // Generamos una vista webview con la lista de los bookmarks desde la que operar todo esto
    // Folders como los de VS ¿? 
    // Enable / disable bookmarks ¿?

    // Para el icono https://github.com/microsoft/vscode-extension-samples/blob/main/decorator-sample/USAGE.md
    //               https://stackoverflow.com/questions/62375509/setting-icons-before-line-number-in-vscode
                    // https://code.visualstudio.com/api/references/vscode-api
                    // https://github.com/alefragnani/vscode-bookmarks/blob/master/src/extension.ts
                    // https://github.com/microsoft/vscode/issues/12111

    // Sobre el global storage :: https://code.visualstudio.com/api/extension-capabilities/common-capabilities
    // Sobre como meter keybindings https://code.visualstudio.com/api/references/contribution-points#contributes.keybindings

    // Sobre webviews https://code.visualstudio.com/api/references/vscode-api#WebviewViewProvider
    //      ojo ejemplo  https://github.com/microsoft/vscode-extension-samples/blob/main/webview-view-sample/src/extension.ts

    // API :   https://code.visualstudio.com/api/references/vscode-api#scm
    //         https://code.visualstudio.com/api/references/activation-events


    /*

    TODO: 

    [X] permitir cambiar el icono de la fila entre estrella o bookmark
    [X] Icono con color en la lista
    [X] repasar tema delete
    [X] Problema delete pulsando boton se seguido si pulso demasiado rápido.
    [X] Borrar una detrás de otra pulsando el botón (seleccionar la siguiente)
    ( [X] Poner la X tan satisfactoria )
    [X] Falta icono de la vista
    [N] Icono correcto columna num de fila. O se hace con un HACK o se pone según el theme (oscuro/luminoso)
        [N] Probar el hack
        [N] hacer según el theme
    [X] Renombrar a bookmarks-lite
    [X] Organizar bien los fuentes. Que se hace con las librerías, que se hace con el css sass...
    [ ] menus
        [X] menu Contextual sobre el numero de linea "add bookmark"
            donde se puede contribuir> https://code.visualstudio.com/api/references/contribution-points
        [ ] Opcion para mostrar vista de bookmarks. No parece que se puedan añadir cosas al menú superior
        [ ] Otros menús
    [X] Tests compatibilidad con otras decoraciones y librerías
    [ ] Publicar.. ¿?
        
        ( ) Instalar como paquetes para que el bundle sea menor ? https://www.ag-grid.com/javascript-data-grid/packages-modules/
    [ ] Repaso a los iconos en los botones de la vista.
    ( [  ] permitir recolocar arrastrando )
    [ ] Test: revisar que se hace con el index

    ------------------------------------------------------------------------------------------------------------------------------------------------

    "Due to limitations in the gutter API, it's impossible to have multiple gutters for the line one code, so it may overlap other extensions which use gutters or conflict with breakpoint functionality."

    ------------------------------------------------------------------------------------------------------------------------------------------------

    hay una instancia de GlobalStatus que se anda usando para trabajar con los bookmark a bajo nivel
    bookmarks-lite.toggle -->
        comando definido en extension.ts
        ejecutado desde botón que se define en el   contributes.commands, contributes.keybindings y contributes.menus (menu de la vista)
    bookmarks-lite.next y .prev --> 
        comando definido en extension.ts
        ejecutado desde botón que se define en el   contributes.commands, contributes.keybindings, contributes.menus.view/title + *.webview/context (menu de la vista y contextual)
        actualiza, abre el doc, etc, y al final llama a vsbprovider.selectFocused(); (el provider puede acceder a la vista interior y hacer un postMessage() )
    Se llama al command "bookmarks-lite.deleteselected"  (desde el menu de la vista, sale xq en la vista están las filas seleccionadas)
        [deprecated]
        Eso llama al proveedor de la vista (vsbprovider.deleteSelected(gs)) que a su vez manda un message a la vista ( this.view.webview.postMessage({ type:'deleteSelected', state:gs.getState() }); )
        En webview.main.js se recibe el mensaje y se hace un setGlobalState() actualizando y haciendo un deleteSelectedRows()
        Ese deleteSelectedRows de la vista manda un mensaje a su vez hacia arriba (vscode.postMessage({ action: 'delete-bookmarks', bookmarks: selRows}); )
        Ese mensaje lo recoge el webview.ts Y eso lanza un vscode.commands.executeCommand('bookmarks-lite.deleteone', bookmark.filename, bookmark.line);  
        Ese comando hace un toggleBookmark y al final hace un updateViewList que llama al vsbprovider.updateList(gs) y eso hace un postmessage de type:'updateList' a la vista. 
        la vista guarda la selección, borra el grid, lo rellena, le mete las filas y recupera la selección
        --------------
        Propuesta simplificación: 
    Se llama al command "bookmarks-lite.deleteselected"        
        Al seleccionar en la lista esta manda lo seleccionado para arriba siempre. Guardamos los filename y line en el estado.
        ( La idea es simplificar el proceso y además independizar de la lista el proceso de borrado para que el repintado no afecte )
        hacemos en el comando un toggleBookmark(), recalculamos la selección y luego refrescamos los iconos y la lista y la selección ahora la coge del estado


    ------------------------------------------------------------------------------------------------------------------------------------------------

    [X] Nombres de bookmark automáticos
    [X] Que funcione el añadir lineas delante y detrás y el borrar líneas
    [X] Que funcione el renombrar ficheros y el borrar ficheros
        [N] Si renombro o borro fuera del vscode? --> que al intentar abrir un bookmark se borre si no existe el fichero
    [X] Que la lista sea con selección de fila (buscar algo hecho muy muy lite ¿?)
        https://code.tutsplus.com/best-javascript-free-and-open-source-data-grid-libraries-and-widgets--cms-93523t
            https://github.com/ag-grid/ag-grid
        https://blog.logrocket.com/5-open-source-javascript-datagrids/
        [X] Lista con cabecera fija, body con scroll
            [X] Estilos VSCODE 
                [X] para cualquier situación
            [N] Selección no seleccione la celda 
            [X] Supr permita borrar el bookmark
                [X] Borrado multiple
            [X] Filtros de columna simples
                [X] Filtro rápido --> https://www.ag-grid.com/javascript-data-grid/filter-quick/
            [N] Que no recoloque las columnas
            [NEXT VERSION] Que recoloque bookmarks
        [X] Doble click en la lista o similar te mande al bookmark
        [X] Click simple permita editar el nombre del bookmark
        [X] Botón de borrar (multiple)
            https://code.visualstudio.com/api/ux-guidelines/panel
            https://code.visualstudio.com/api/references/contribution-points#contributes.menus
            https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
        [X] Botón de sig / anterior. Que marque en la lista el que se hace foco
        [X] Arreglar el icono de la vista: https://code.visualstudio.com/api/references/contribution-points#contributes.viewsContainers
            y el icono del lateral: https://www.svgrepo.com/svg/526487/bookmark-square-minimalistic – you must give appropriate credit, provide a link to the license, and indicate if changes were made
        [X] menu contextual webview
            https://stackoverflow.com/questions/70788421/context-menu-copy-is-not-working-in-vscode-webview-but-ctrlc-is-working-fine
            https://code.visualstudio.com/api/extension-guides/webview
            [X] navegar
            [X] Borrar
        [X] Formato lista
            [X] Icono en la lista   https://fontello.com/
            [X] Formato nums

    [ ] Icono correcto 
        [X] vista bookmarks
        [ ] Icono correcto en el borde, colores correctos zona numeros de linea.
            me gustaría usar colores del tema para el icono de la linea pero 
                parece que solo puedo usar una imagen. Si uso un SVG podría hacerlo pero si metiera estilos css que parece que no puedo.
            Tampoco parece que me deje meter un before o un after.
            Lo único que parece que puedo hacer es elegir un icono para los temas dark y otro para los light

    ( ) optimizar la estructura de los bookmarks ¿? indexar por fichero
    [ ] Recolocar el orden
    [ ] menus
        [ ] menu Contextual sobre el numero de linea
        [ ] Opcion para mostrar vista de bookmarks. View toggle xxxxx
    [ ] compatibilidad con otras decoraciones y librerías, ej: con el signo de breakpoint
    [ ] Publicar.. 
        ( ) Instalar como paquetes para que el bundle sea menor https://www.ag-grid.com/javascript-data-grid/packages-modules/

        

    */
}



// This method is called when your extension is deactivated
export function deactivate() {}