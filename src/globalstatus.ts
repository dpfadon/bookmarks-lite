import * as vscode from 'vscode';

// DTOs ---------------------------------
export class bookmarkState {
    // Indice de la linea con el foco (el ultimo bookmark al que hemos navegado, desde el que navegamos si hacemos next o prev)
    focus: number = -1; 
    lines: bookmarkInfo[] = [];
    selectedIcon = 2;
    selection: any[] = [];
}
export class bookmarkInfo {
    constructor(
        public index: number, // Se usa para saber que nombre poner al siguiente bookmark
        public name: string,
        public line: number,
        public filename: string
    ) {
        this.line = line;
        this.filename = filename;
    }
}

// ESTADO ------------------------------------------------------------------------
export class GlobalStatus {
    // public context: vscode.ExtensionContext;
    public constructor(public context: vscode.ExtensionContext) {
        this.context = context;
    }

    public getState() {
        // https://code.visualstudio.com/api/references/vscode-api#Memento
        // let vsbstate: bookmarkState = this.context.globalState.get('BookmarksLiteState') as bookmarkState;
        let vsbstate: bookmarkState = this.context.workspaceState.get('BookmarksLiteState') as bookmarkState;
        if (!vsbstate) { // Create new status object
            vsbstate = new bookmarkState();
        }
        return vsbstate;
    }

    public setState(vsbstate: bookmarkState) {
        this.context.workspaceState.update('BookmarksLiteState', vsbstate);
    }  

    public index = 1;

    public toggleBookmark(filename: string, line: number) {
        const vsbstate: any = this.getState();
        const index = this.getIndexOf(filename, line);
        if (index !== -1){      // Ya existía: toggle off
            vsbstate.lines.splice(index, 1);
            if (vsbstate.lines.length === 0) { // Si no quedan bookmarks, reseteamos el foco
                vsbstate.focus = -1;
            } else {
                vsbstate.focus = index >= vsbstate.lines.length ? vsbstate.lines.length-1 : index;
            }
        } else {  // no existía: toggle on
            const allIndex = vsbstate.lines.map( (item: any) => item.index );
            const lastIndex = allIndex.sort( (a:number,b:number) => a - b).pop();
            const nextIndex = (lastIndex === null || lastIndex === undefined) ? 1 : lastIndex + 1;
            vsbstate.lines.push( new bookmarkInfo( nextIndex, 'Bookmark'+nextIndex, line, filename ) );
            vsbstate.focus = vsbstate.lines.length-1;
        }
        this.setState(vsbstate);
    }

    public getIndexOf(filename: string, line: number) {
        return this.getState().lines.findIndex((item: bookmarkInfo) => item.line === line && item.filename === filename);
    }
    public getIndexOfIn(filename: string, line: number, items: any[]) {
        return items.findIndex((item: bookmarkInfo) => item.line === line && item.filename === filename);
    }    

    public setFocus(index: number) {
//debugger;
        const vsbstate: any = this.getState();
        vsbstate.focus = index;
    }

    public focusNext() {
//debugger;
        const vsbstate: any = this.getState();
        vsbstate.focus++;
        if (vsbstate.focus>=vsbstate.lines.length) {
            vsbstate.focus = vsbstate.lines.length > 0 ? 0 : -1;
        }
        this.setState(vsbstate);
    }
    public focusPrev() {
//bugger;
        const vsbstate: any = this.getState();
        vsbstate.focus--;
        if (vsbstate.focus < 0) {
            vsbstate.focus = vsbstate.lines.length > 0 ? vsbstate.lines.length-1 : -1;
        }             
        this.setState(vsbstate);
    }

    public setSelectedIcon(selectedIcon: number) {
        const vsbstate: any = this.getState();
        vsbstate.selectedIcon = selectedIcon;
        this.setState(vsbstate);
    }   
    public getSelectedIcon() {
        return this.getState().selectedIcon;
    }        

    public getFocusedBookmark() {
        const vsbstate: any = this.getState();
        const lines: any = vsbstate.lines;
        if ( vsbstate.focus!==-1 && lines[vsbstate.focus]) {
            return lines[vsbstate.focus];
        }
    }

    // Posibilidad: indexar por fichero para mejorar velocidad
    public getBookmarkedLinesOfFile(filename: string) {
        const bookmarks = this.getBookmarksOfFile(filename).map((item: any) => item.line);
        return bookmarks;
    }
    public getBookmarksOfFile(filename: string) {
        const vsbstate: any = this.getState();
        const bookmarks = vsbstate.lines.filter( (item: any) => item.filename === filename );
        return bookmarks;
    }

    public onRenameFile(file: any) {
        if (file) {
            const oldfilename = file.oldUri.fsPath;
            const newfilename = file.newUri.fsPath;
            const bookmarks = this.getBookmarksOfFile(oldfilename);
            bookmarks.forEach((bkm:any) => {
                bkm.filename = newfilename;       
            });
        }
    }
    public onDeleteFile(file: any) {
        if (file) {
            const filename = file.fsPath;
            const bookmarks = this.getBookmarksOfFile(filename);
            bookmarks.forEach((bkm:any) => {
                this.toggleBookmark(filename, bkm.line);
            });
        }
    }   

    public renameBookmark(filename: string, line: number, newName: string) {
        const vsbstate: any = this.getState();
        const index = vsbstate.lines.findIndex((item: bookmarkInfo) => item.line === line && item.filename === filename);
        if (index !== -1){
            vsbstate.lines[index].name = newName;
        }
        this.setState(vsbstate);
    }

    public setSelected(selection: any[]) {
        const vsbstate: any = this.getState();
        vsbstate.selection = selection;
        this.setState(vsbstate);    
    }
    public getSelected() { return this.getState().selection; }

    public deleteSelectedAndUpdateSelection() {
        const vsbstate: any = this.getState();
        const lines = this.getState().lines;
        const selectedItems: any = this.getSelected();
        if (selectedItems && selectedItems.length > 0) {
            // Selecciono el siguiente elemento (al primero de los seleccionados) o ninguno según toque
            const selectedItem = selectedItems ? selectedItems[0] : null;
            const selIndex = this.getIndexOf(selectedItem.filename, selectedItem.line);
            let nextIndex = lines.findIndex( (row,i)=>(i>selIndex && this.getIndexOfIn(row.filename,row.line,selectedItems) === -1) ); // Indice del siguiente elemento no seleccionado para borrar
            if (nextIndex === -1 && selIndex-1 >= 0) { // Si hemos borrado hasta el final, cogemos el anterior si lo hay
                nextIndex = selIndex-1;
            }
            if (nextIndex !== -1) {
                this.setSelected([lines[nextIndex]]);
            } else {
                this.setSelected([]);
            }
            // Eliminamos los bookmark
            selectedItems.forEach((bookmark:any) => {
                this.toggleBookmark(bookmark.filename, bookmark.line);
            });
        }
    }

}
