const createGrid = agGrid.createGrid; // ag-grid https://www.ag-grid.com/javascript-data-grid/deep-dive/#load-new-data
const vscode = acquireVsCodeApi(); // Vscode


let globalstate = null;
function setGlobalState(g) { 
    globalstate = g;
    actualizeSelectedBtnFromState();
}
function stateGetLines() { return globalstate && globalstate.lines ? globalstate.lines : []; }
function stateGetFocused() { return ( globalstate && globalstate.lines[globalstate.focus] ) ? globalstate.lines[globalstate.focus] : []; }
function stateGetSelectedIcon() { return globalstate && globalstate.selectedIcon ? globalstate.selectedIcon : null; }
function stateGetSelection() { return globalstate && globalstate.selection ? globalstate.selection : []; }

let gridApi = null;

let cellEditingInProgress = false;

// This script will be run within the webview itsel. It cannot access the main VS Code APIs directly.
(function () {
    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        var message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'xx':
            case 'yy':
            case 'updateList': 
            case 'updateState': 
                setGlobalState(message.state);
                updateListWithState();
                break;
            case 'selectFocused':
                setGlobalState(message.state);
                selectFocusedInState();
                break;
        }
    });
    askForState();
    createBookmarkGrid();
    createButtons();
    addGlobalEvents();
}());

function askForState() {
    vscode.postMessage({ action: 'ask-for-state'}); // Esto lanza un 'ask-for-state' arriba, allí se retorna un 'updateState' para abajo que termina pintando la lista
}

function createButtons() {
    const btn1elem = document.getElementById("btn-useicon1");
    const btn2elem = document.getElementById("btn-useicon2");
    btn1elem.addEventListener('click', ()=> {
        vscode.postMessage({ action: 'actualice-icon', iconindex: 1 }); // Lo captura en webview.ts
    });
    btn2elem.addEventListener('click', ()=> {
        vscode.postMessage({ action: 'actualice-icon', iconindex: 2 });
    });
    actualizeSelectedBtnFromState();
}
function actualizeSelectedBtnFromState() {
    const btn1elem = document.getElementById("btn-useicon1");
    const btn2elem = document.getElementById("btn-useicon2");    
    const selIcon = stateGetSelectedIcon();
    removeClassFromElem(btn1elem, 'btn-selected');
    removeClassFromElem(btn2elem, 'btn-selected');
    addClassToElem((selIcon===1?btn1elem:btn2elem), 'btn-selected');
    updateListWithState();
}

function addClassToElem(elem, cls) {
    if (!elem.classList.contains(cls)) {
        elem.classList.add(cls);
    }
}
function removeClassFromElem(elem, cls) {
    if (elem.classList.contains(cls)) {
        elem.classList.remove(cls);
    }
}

function createBookmarkGrid() {
    // API opciones: https://www.ag-grid.com/javascript-data-grid/filter-text/
    // API opciones: https://www.ag-grid.com/javascript-data-grid/grid-options/#reference-rowModels
    // API columnas https://www.ag-grid.com/javascript-data-grid/column-definitions/
    // API opciones https://www.ag-grid.com/javascript-data-grid/column-properties/
    var gridOptions = {
        overlayNoRowsTemplate: '<div style="font-style: italic;">No bookmarks to show. Create bookmarks using the bar button, the context menu on the line number or using the key combination (ALT+K+K by default).</div>',
        columnDefs: [
            { 
                headerName: 'Bookmark', field: 'name', 
                singleClickEdit: true,
                // filter: 'agTextColumnFilter', maxNumConditions: 1, floatingFilter: true, suppressMenu: true,
                width: 120,
                editable: true,
                // cellRenderer: (params) => { return '<i class="cell-icon icon-bookmark-black"></i>' + params.value; }
                cellRenderer: (params) => { return '<img class="row-icon" src="'+imgBaseUri+'/bookmarkicon'+stateGetSelectedIcon()+'.svg"></img>' + params.value; }

            },
            { 
                headerName: 'File Location', field: 'filename',
                flex: 1
            },
            { 
                headerName: 'Line Number', field: 'line',
                valueGetter: (args) => { return args.data.line+1; },
                width: 90
            }
        ],
        rowData: [],
        processRowPostCreate : (params) => {
            if (params.eRow && params.eRow.dataset) {
                const vscodeContext = {
                    'preventDefaultContextMenuItems': true,
                    'webviewSection': 'bookmark',
                    data: params.node.data
                };
                params.eRow.dataset.vscodeContext = JSON.stringify(vscodeContext);
            }
        },
        // rowSelection: 'single',
        singleClickEdit : true,
        animateRows: false,
        rowSelection: 'multiple',
        getRowId: getRowId,
        readOnlyEdit: true,
        onRowDoubleClicked: onGridRowDoubleClicked,
        onCellEditRequest: onCellEditRequest,
        onCellEditingStarted: onCellEditingStarted,
        onCellEditingStopped: onCellEditingStopped,
        // selectionChanged: onSelectionChanged,
        onSelectionChanged: onSelectionChanged
    };    
    const eGridDiv = document.querySelector('#myGrid');
    gridApi = createGrid(eGridDiv, gridOptions);
}


function getRowId(rowinfo) { return getRowIdByData(rowinfo.data); }
function getRowIdByData(rowdata) { return rowdata.filename + '##' + rowdata.line; }

function onCellEditingStarted() { cellEditingInProgress = true; }
function onCellEditingStopped() { cellEditingInProgress = false; }

function onCellEditRequest(event) {
    const data = event.data;
    const field = event.colDef.field;
    const newValue = event.newValue;
    if (newValue && newValue.trim() !== '') { // Si no han dejado el campo vacío establecemos el valor
        data[field] = newValue;
        const rowNode = gridApi.getRowNode( getRowIdByData(event.data) );
        gridApi.refreshCells({rowNodes: [rowNode], columns: [event.column]});
        vscode.postMessage({ action: 'edit-bookmark', filename: data.filename, line: data.line, newValue: newValue, field: field});
    }
}

function onGridRowDoubleClicked(ev){
    const index = ev.rowIndex;
    vscode.postMessage({ action: 'navigate-to', index: index});
}
function onSelectionChanged(ev) {
    const selected = ev.api.getSelectedRows();
    vscode.postMessage({ action: 'update-selection-from-view', selected});
}
    

function updateListWithState() {
    const lines = stateGetLines();
    const stateSelectionIds = stateGetSelection().map( item => getRowIdByData(item) );
    gridApi.setGridOption('rowData', []); // Fix para que cambie el icono
    gridApi.setGridOption('rowData', lines);
    setSelectedByIds(stateSelectionIds); // reseleccionamos desde el estado
}

function setSelectedByIds(ids) {
    const selNodes = [];
    ids.forEach(id => {
        const rowNode = gridApi.getRowNode( id ); 
        if (rowNode) {
            selNodes.push(rowNode);
        }
    });  
    gridApi.deselectAll(); // https://www.ag-grid.com/javascript-data-grid/grid-api/#reference-selection
    gridApi.setNodesSelected({ nodes: selNodes, newValue: true });    
}

function selectFocusedInState() {
    const focusedrow = stateGetFocused();
    const rowNode = gridApi.getRowNode( getRowIdByData(focusedrow) );
    if (rowNode) {
        gridApi.deselectAll(); // https://www.ag-grid.com/javascript-data-grid/grid-api/#reference-selection
        gridApi.setNodesSelected({ nodes: [rowNode], newValue: true });
    }
}

/*
function deleteSelectedRows() {
    // TODO: BORRAR: ojo al caso de borrar con una tecla
    const selRows = gridApi.getSelectedRows(); // Los {filename, line, ...} 
    if (selRows && selRows.length > 0) {
        // Seleccionamos el siguiente elemento de la lista
        const rowData = gridApi.getGridOption("rowData");
        const selIndex = rowData.indexOf(selRows[0]); // Index de la primera fila borrada
        let nextIndex = rowData.findIndex( (row,i)=>(i>selIndex && selRows.indexOf(row) === -1) ); // Indice del siguiente elemento no seleccionado para borrar
        if (nextIndex === -1 && selIndex-1 >= 0) { // Si hemos borrado hasta el final, cogemos el anterior si lo hay
            nextIndex = selIndex-1;
        }
        gridApi.deselectAll();
        if (nextIndex !== -1) {
            const nextNode = gridApi.getRowNode( getRowIdByData(rowData[nextIndex]) ); 
            nextNode.setSelected(true);
        }
        // API: https://www.ag-grid.com/javascript-data-grid/row-selection/
        vscode.postMessage({ action: 'delete-bookmarks', bookmarks: selRows});
    }  
}*/

function addGlobalEvents(ev) {
    document.body.onkeydown = function(e){
        if (!cellEditingInProgress && e.code === 'Delete') {
            vscode.postMessage({ action: 'execute.deleteselected'});
            // const selRows = gridApi.getSelectedRows(); // Los {filename, line, ...} 
            // deleteSelectedRows();
            // TODO: REHACER 
        }
    };
}

function onFilterTextBoxChanged() {
    gridApi.setGridOption( 'quickFilterText', document.getElementById('filter-text-box').value );
}
