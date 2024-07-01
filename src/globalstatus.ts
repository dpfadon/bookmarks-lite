import * as vscode from 'vscode';

// DTOs ---------------------------------
export class bookmarkState {
    focus: number = -1; // Indice de la linea con el foco (el ultimo bookmark al que hemos navegado, desde el que navegamos si hacemos next o prev)
    lines: bookmarkInfo[] = [];
    selectedIcon = 2;
    selection: any[] = [];
}
export class bookmarkInfo {
    constructor(
        public index: number,
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
        } else {                // no existía: toggle on
            let lastindex = vsbstate.lines.map( (item: any) => item.index ).sort().pop(); // Buscamos el indice mayor del bookmark para poner el siguiente
            // Mal. index no es el valor junto al nombre actualmente, esto da lugar a repetir el nombre
            lastindex = lastindex === null || lastindex === undefined ? 0 : lastindex;
            vsbstate.lines.push( new bookmarkInfo( lastindex+1, 'Bookmark'+(lastindex+1), line, filename ) );
            vsbstate.focus = vsbstate.lines.length-1;
        }
        this.setState(vsbstate);
    }

    /*public xxxBookmark(filename: any, line: number) {
        const vsbstate: any = this.getState();
        debugger;
    }*/

    public getIndexOf(filename: string, line: number) {
        return this.getState().lines.findIndex((item: bookmarkInfo) => item.line === line && item.filename === filename);
    }
    public getIndexOfIn(filename: string, line: number, items: any[]) {
        return items.findIndex((item: bookmarkInfo) => item.line === line && item.filename === filename);
    }    

    public setFocus(index: number) {
        const vsbstate: any = this.getState();
        vsbstate.focus = index;
    }

    public focusNext() {
        const vsbstate: any = this.getState();
        vsbstate.focus++;
        if (vsbstate.focus>=vsbstate.lines.length) {
            vsbstate.focus = vsbstate.lines.length > 0 ? 0 : -1;
        }
        this.setState(vsbstate);
    }
    public focusPrev() {
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
        const lines = this.getState().lines;
        const selectedItems: any = this.getSelected();
        if (selectedItems && selectedItems.length > 0) {
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
            selectedItems.forEach((bookmark:any) => {
                this.toggleBookmark(bookmark.filename, bookmark.line);
            });
        }
    }

}
