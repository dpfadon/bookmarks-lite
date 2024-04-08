import * as vscode from 'vscode';
import { GlobalStatus } from './globalstatus';


// VISTA -------------------------- bookmarks-list
export class BookmarksLiteViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    constructor(
        private readonly extensionUri: vscode.Uri,
        private gs: GlobalStatus
    ) { }
    public resolveWebviewView( webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken ) {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true }; // Allow scripts in the webview
        webviewView.webview.html = this.getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage( // Mensaje de la VISTA al VSCODE
            (message: any) => {
                if (message.action === 'ask-for-state') {
                    this.updateState(this.gs);
                } else if (message.action === 'navigate-to') {
                    vscode.commands.executeCommand('bookmarks-lite.show', message.index);
                } else  if (message.action === 'delete-bookmarks') {
                    message.bookmarks.forEach((bookmark:any) => {
                        vscode.commands.executeCommand('bookmarks-lite.deleteone', bookmark.filename, bookmark.line);    
                    });
                } else if (message.action ===  'edit-bookmark') {
                    if (message.field = 'name') {
                        this.gs.renameBookmark(message.filename, message.line, message.newValue);
                    }
                } else if (message.action === 'actualice-icon') {
                    vscode.commands.executeCommand('bookmarks-lite.actualizeicon', message.iconindex); // Esto actualiza el status y pinta los cambios en el editor
                    this.updateState(this.gs); // Esto ya pone el boton seleccionado adecuadamente en la vista
                } else if (message.action === 'update-selection-from-view') {
                    this.gs.setSelected(message.selected);
                }  else if (message.action === 'execute.deleteselected') {  // la webview quiere borrar los seleccionados
                    vscode.commands.executeCommand('bookmarks-lite.deleteselected');
                }
            }
        );
    }

    public updateState (gs: GlobalStatus) {
        if (this.view) {
            this.view.webview.postMessage({ type:'updateState', state:gs.getState() }); // Mensaje del VSCODE a la VISTA
        }
    }

    public updateList(gs: GlobalStatus) {
        if (this.view) {
            this.view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
            this.view.webview.postMessage({ type:'updateList', state:gs.getState() }); // Mensaje del VSCODE a la VISTA
            // https://code.visualstudio.com/api/extension-guides/webview#passing-messages-from-an-extension-to-a-webview
        }
    } 

    public selectFocused() {
        if (this.view) {
            this.view.webview.postMessage({ type:'selectFocused', state:this.gs.getState() }); // Mensaje del VSCODE a la VISTA
        }
    }
 
    private getHtml(webview: vscode.Webview) {
        const nonce = getNonce(); // Use a nonce to only allow a specific script to be run.
        return `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <!--
                    Use a content security policy to only allow loading styles from our extension directory,
                    and only allow scripts that have a specific nonce.
                    (See the 'webview-sample' extension sample for img-src content security policy examples)
                    -->
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <link href="${webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview-resources', 'reset.css'))}" rel="stylesheet">
                    <link href="${webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview-resources', 'utils.css'))}" rel="stylesheet">
                    <link href="${webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview-resources', 'webview.main.css'))}" rel="stylesheet">
                    <link href="${webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview-resources/ag-grid', 'ag-grid.min.css'))}" rel="stylesheet">
                </head>
                <body>
                    <div class="ALLSPACE FLCOL main-container" data-vscode-context='{"preventDefaultContextMenuItems": true }'>
                        <div class="filtercontainer">
                            <div class="btn-item" id="btn-useicon1">
                                <img src="${webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'img', 'bookmarkicon1.svg'))}"/>
                            </div>                    
                            <div class="btn-item" id="btn-useicon2">
                                <img src="${webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'img', 'bookmarkicon2.svg'))}"/>
                            </div>
                            <div class="btn-separator" style="margin-left: 0.3rem;">&nbsp;</div>
                            <label>Quick Filter:</label>
                            <input type="text" id="filter-text-box" placeholder="Filter bookmarks by any field..." oninput="onFilterTextBoxChanged()"/>
                        </div>
                        <div class="FLADJUSTV gridcontainer">
                            <div id="myGrid" style="height: 100%; width: 100%"></div>
                        </div>
                    </div>
                    <script> const imgBaseUri = '${webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'img'))}'; </script>
                    <script nonce="${nonce}" src="${webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview-resources/ag-grid', 'ag-grid-community.min.js'))}"></script>
                    <script nonce="${nonce}" src="${webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview-resources', 'webview.main.js'))}"></script>
                </body>
            </html>
        `;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}