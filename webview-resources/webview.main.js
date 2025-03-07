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

// Este script corre en la propia vista web, no en el contexto de vscode
(function () {
    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        var message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'updateList': 
            case 'updateState': 
                setGlobalState(message.state);
                updateListWithState();
                check_updateDom();
                // focusSelected(); // No queda bien al borrar uno que vaya al ppo
                break;
            case 'selectFocused':
                setGlobalState(message.state);
                selectFocusedInState();
                // focusSelected();
                break;
        }
    });
    askForState();
    check_initialize();
    createBookmarkGrid();
    createButtons();
    addGlobalEvents();
}());

function askForState() {
    vscode.postMessage({ action: 'ask-for-state'}); // Esto lanza un 'ask-for-state' arriba, allí se retorna un 'updateState' para abajo que termina pintando la lista
}

function check_initialize() {
    u('#autoOpenListCheck').on('click', ()=> {
        globalstate.showListOnAction = !globalstate.showListOnAction; // No queremos acceder al global state directamente, lo delegamos a la webview provider
        this.check_updateDom();
        vscode.postMessage({ action: 'actualice-showListOnAction', showListOnAction: globalstate.showListOnAction }); // Lo captura en el webview provider
    });
    // check_updateDom(); // Si hacemos esto podemos encontrar que vale null
}
function check_updateDom() {
    if (globalstate.showListOnAction) {
        u('#autoOpenListCheck .check-box').addClass('checked');
    } else {
        u('#autoOpenListCheck .check-box').removeClass('checked');
    }
}

function createButtons() {
    u("#btn-useicon1").on('click', ()=> {
        vscode.postMessage({ action: 'actualice-icon', iconindex: 1 }); // Lo captura en webview.ts
    });
    u("#btn-useicon2").on('click', ()=> {
        vscode.postMessage({ action: 'actualice-icon', iconindex: 2 }); // Lo captura en webview.ts
    });
    u("#btn-useicon3").on('click', ()=> {
        vscode.postMessage({ action: 'actualice-icon', iconindex: 3 }); // Lo captura en webview.ts
    });
    actualizeSelectedBtnFromState();
}
function actualizeSelectedBtnFromState() {
    const selIcon = stateGetSelectedIcon();
    u('#btn-useicon1, #btn-useicon2, #btn-useicon3').removeClass('btn-selected');
    u('#btn-useicon' + selIcon).addClass('btn-selected');
    updateListWithState();
}

function createBookmarkGrid() {
    // API opciones: https://www.ag-grid.com/javascript-data-grid/filter-text/
    // API opciones: https://www.ag-grid.com/javascript-data-grid/grid-options/#reference-rowModels
    // API columnas https://www.ag-grid.com/javascript-data-grid/column-definitions/
    // API opciones https://www.ag-grid.com/javascript-data-grid/column-properties/
    var gridOptions = {
        overlayNoRowsTemplate: '<div style="font-style: italic;">No bookmarks to show. Create bookmarks using the bar button, the context menu on the line number or using the key combination (ALT+K+K by default).</div>',
        defaultColDef: { sortable: false },        
        columnDefs: [
            { 
                headerName: 'Bookmark', field: 'name', 
                singleClickEdit: true,
                // filter: 'agTextColumnFilter', maxNumConditions: 1, floatingFilter: true, suppressMenu: true,
                width: 140,
                editable: true,
                // cellRenderer: (params) => { return '<i class="cell-icon icon-bookmark-black"></i>' + params.value; }
                cellRenderer: (params) => { 
                    // console.log('params', params);
                    const isFocused = globalstate.focus === params.rowIndex;
                    return '<span class="editable-item">'
                        +'<img class="row-icon'+ (isFocused ? ' focused-row-icon' : '') +'" src="'+imgBaseUri+'/bookmarkicon'+stateGetSelectedIcon()+'.svg"></img>'
                        + params.value
                        + '</span>'; 
                }
            },
            { 
                headerName: 'Line',
                field: 'line',
                valueGetter: (args) => { return args.data.line+1; },
                width: 60
            },            
            { 
                headerName: 'File Location',
                field: 'filename',
                cellClass: 'filename-col',
                flex: 1
            },
            { 
                cellRenderer: (rowInfo) => {
                    const rowId = getRowId(rowInfo);
                    const escapedRowId = rowId.replaceAll('\\', '\\\\');
                    return '<img onclick="deleteRowById(\''+ escapedRowId +'\')" class="row-button" src="'+imgBaseUri+'/cross.svg"></img>'; 
                },
                width:25
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
        singleClickEdit : true,
        animateRows: false,
        rowSelection: 'multiple', // rowSelection: 'single',
        // suppressCellFocus:true, 
        suppressHeaderFocus: true,
        getRowId: getRowId,
        readOnlyEdit: true,
        onRowDoubleClicked: onGridRowDoubleClicked,
        onCellEditRequest: onCellEditRequest,
        onCellEditingStarted: onCellEditingStarted,
        onCellEditingStopped: onCellEditingStopped,
        onSelectionChanged: onSelectionChanged,
        // onCellFocused: onCellFocused,
        onCellKeyDown: onCellKeyDown
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


function onCellKeyDown(ev) {
    // Hacemos que cuando movamos el foco de celda se seleccione la fila
    if (ev.event.code === "ArrowUp" || ev.event.code === "ArrowDown") {
        setTimeout( ()=> {
            const focusedrowIndex = gridApi.getFocusedCell().rowIndex;
            selectRowByIndex(focusedrowIndex);
        }, 1);
    } else if (ev.event.code === "Enter" && (ev.colDef.field === 'line' || ev.colDef.field === 'filename')) {
        this.onGridRowDoubleClicked(ev);
    }
}
    

function updateListWithState() {
    const lines = stateGetLines();
    const stateSelectionIds = stateGetSelection().map( item => getRowIdByData(item) );
    gridApi.setGridOption('rowData', []); // Fix para que cambie el icono
    gridApi.setGridOption('rowData', lines);
    setSelectedByIds(stateSelectionIds); // reseleccionamos desde el estado
}

function focusSelected() {
    const selection = gridApi.getSelectedNodes();
    if (selection && selection.length > 0) {
        const selectedRow = selection[0];
        const rowIndex = selectedRow.rowIndex;
        gridApi.ensureIndexVisible(rowIndex);
        // gridApi.setFocusedCell(rowIndex, 'name');
    }
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


function addGlobalEvents(ev) {
    document.body.onkeydown = function(e){
        if (!cellEditingInProgress && e.code === 'Delete') {
            vscode.postMessage({ action: 'execute.deleteselected'});
        }
    };
}

function onFilterTextBoxChanged() {
    const value = u('#filter-text-box').first().value;
    debugger;
    gridApi.setGridOption( 'quickFilterText', value );
    /*
    gridApi.setGridOption( 'quickFilterText', document.getElementById('filter-text-box').value );
    */
}


function deleteRowById(id) {
    // bookmark.filename, bookmark.line
    const gridRowData = gridApi.getGridOption("rowData");
    const bookmarkData = gridRowData.find( (item)=> { return getRowIdByData(item) === id; } );
    if (bookmarkData) {
        vscode.postMessage({ action: 'delete-bookmarks', bookmarks: [{filename: bookmarkData.filename, line: bookmarkData.line}]});
    }
}

function selectRowByIndex( index ) {
    const gridRowData = gridApi.getGridOption("rowData");
    const rowData = gridRowData[index];
    const rowNode = gridApi.getRowNode( getRowIdByData(rowData) );
    if (rowNode) {
        gridApi.deselectAll(); // https://www.ag-grid.com/javascript-data-grid/grid-api/#reference-selection
        gridApi.setNodesSelected({ nodes: [rowNode], newValue: true });
    }
}

/*
function onAutoOpenCheckboxChanged() {
    // vscode.postMessage({ action: 'update-auto-open', value: document.getElementById('auto-open-checkbox').checked });
}
*/