window.hud = {};

(function(exports) {
    let spatialInterface;
    let container, reticle, pencilButton;
    let screenWidth, screenHeight;
    let isEditingMode = false;
    const reticleSize = 300;
    let callbacks = {
        onIsEditingChanged: []
    };

    function init(spatialInterface_, rendererWidth_, rendererHeight_, parentElement_) {
        console.log('init HUD');
        spatialInterface = spatialInterface_;
        screenWidth = rendererWidth_;
        screenHeight = rendererHeight_;

        container = document.createElement('div');
        container.id = 'HUD';
        container.style.left = '0';
        container.style.top = '0';
        container.style.width = rendererWidth_ + 'px';
        container.style.height = rendererHeight_ + 'px';
        container.style.position = 'absolute';
        // container.style.backgroundColor = 'rgba(255,0,0,0.3)';
        container.style.pointerEvents = 'none';
        // container.innerText = 'HUD Inner Text';
        parentElement_.appendChild(container);

        pencilButton = createButton('pencilButton', 'resources/pencil-icon.svg', 60, {left: '30px', bottom: '30px', pointerEvents: 'auto'});
        pencilButton.addEventListener('pointerup', onPencilButtonPressed);
        container.appendChild(pencilButton);
    }

    function createButton(id, src, size, style) {
        let thisButton = document.createElement('div');
        thisButton.id = id;
        thisButton.classList.add('remoteOperatorButton');

        // size and position are determined programmatically rather than in CSS
        let buttonWidth = size;
        let buttonHeight = size;
        thisButton.style.width = buttonWidth + 'px';
        thisButton.style.height = buttonHeight + 'px';

        if (typeof style !== 'undefined') {
            for (let prop in style) {
                thisButton.style[prop] = style[prop];
            }
        }

        let thisButtonIcon = document.createElement('img');
        thisButtonIcon.src = src;
        thisButton.appendChild(thisButtonIcon);

        thisButtonIcon.width = buttonWidth + 'px';
        thisButtonIcon.height = buttonHeight + 'px';
        thisButtonIcon.style.width = buttonWidth + 'px';
        thisButtonIcon.style.height = buttonHeight + 'px';
        thisButtonIcon.style.position = 'absolute';
        thisButtonIcon.style.top = '0';
        thisButtonIcon.style.left = '0';

        // pencilButton.addEventListener('pointerup', onPencilButtonPressed);
        // setupButtonVisualFeedback(pencilButton);

        return thisButton;
    }

    function onPencilButtonPressed() {
        console.log('pencil button pressed');
        // showEditingHUD();

        callbacks.onIsEditingChanged.forEach(function(callback) {
            callback(true);
        });
    }

    function showEditingHUD() {
        console.log('show editing HUD');
        isEditingMode = true;

        if (!reticle) {
            reticle = document.createElement('img');
            reticle.src = 'resources/drawingReticleWhite.svg';
            reticle.style.width = reticleSize + 'px';
            reticle.style.height = reticleSize + 'px';
            reticle.style.left = (screenWidth / 2 - reticleSize / 2) + 'px';
            reticle.style.top = (screenHeight / 2 - reticleSize / 2) + 'px';
            reticle.style.position = 'absolute';
            container.appendChild(reticle);
        }

        reticle.style.display = '';
        pencilButton.style.display = 'none';
    }

    function hideEditingHUD() {
        console.log('hide editing HUD');
        isEditingMode = false;

        if (reticle) {
            reticle.style.display = 'none';
        }
        pencilButton.style.display = '';
    }

    function pointerDown() {
        if (isEditingMode) {
            reticle.style.display = '';
        }
    }

    function pointerMove(screenX, screenY) {
        if (!isEditingMode) { return; }
        if (reticle) {
            reticle.style.left = (screenX - reticleSize / 2) + 'px';
            reticle.style.top = (screenY - reticleSize / 2) + 'px';
        }
    }

    function pointerUp() {
        // reticle.style.display = 'none';
        reticle.style.left = (screenWidth / 2 - reticleSize / 2) + 'px';
        reticle.style.top = (screenHeight / 2 - reticleSize / 2) + 'px';
    }

    function onIsEditingChanged(callback) {
        callbacks.onIsEditingChanged.push(callback);
    }

    exports.init = init;
    exports.showEditingHUD = showEditingHUD;
    exports.hideEditingHUD = hideEditingHUD;

    exports.pointerDown = pointerDown;
    exports.pointerMove = pointerMove;
    exports.pointerUp = pointerUp;

    exports.onIsEditingChanged = onIsEditingChanged;

})(window.hud);
