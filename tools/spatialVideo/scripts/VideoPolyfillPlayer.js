class VideoPolyfillPlayer { // TODO: replace with non-video element ffmpeg approach
    constructor() {
        this.videoElement = document.createElement('video');
        this.videoElement.width = 256;
        this.videoElement.loop = true;
        this.videoElement.muted = true;
        this.videoElement.playsInline = true;
        this.videoElement.crossOrigin = 'Anonymous';
        this.videoElement.style.display = 'none';

        let source = document.createElement('source');
        this.videoElement.appendChild(source);

        this.videoElement.setSrc = src => {
            source.src = src;
            source.type = 'video/mp4';
            this.videoElement.load();
        };

        this.onloadedmetadata = () => {};
        this.videoElement.onloadedmetadata = evt => {
            this.onloadedmetadata(evt);
        };
    }
    setSrc(src) {
        this.videoElement.setSrc(src);
    }
    play() {
        return this.videoElement.play();
    }
    pause() {
        this.videoElement.pause();
    }
    get currentTime() {
        return this.videoElement.currentTime;
    }
    set currentTime(time) {
        this.videoElement.currentTime = time;
    }
    drawToContext(context, dx, dy, dw, dh) {
        //TODO: implement
    }
}

class VideoElementPlayer {
    constructor() {
        this.videoElement = document.createElement('video');
        this.videoElement.width = 256;
        this.videoElement.loop = true;
        this.videoElement.muted = true;
        this.videoElement.playsInline = true;
        this.videoElement.crossOrigin = 'Anonymous';
        this.videoElement.style.display = 'none';
        // document.body.appendChild(this.videoElement);

        let source = document.createElement('source');
        this.videoElement.appendChild(source);

        this.videoElement.setSrc = src => {
            source.src = src;
            source.type = 'video/mp4';
            this.videoElement.load();
        };

        this.onloadedmetadata = () => {};
        this.videoElement.onloadedmetadata = evt => {
            this.onloadedmetadata(evt);
        };
    }
    setSrc(src) {
        src = src.replace('https://toolboxedge.net', `${window.location.origin}/proxy`); // Routes through proxy
        this.videoElement.setSrc(src);
    }
    play() {
        this.videoElement.play().then(() => {});
    }
    pause() {
        this.videoElement.pause();
    }
    get currentTime() {
        return this.videoElement.currentTime;
    }
    set currentTime(time) {
        this.videoElement.currentTime = time;
    }
    drawToContext(context, dx, dy, dw, dh) {
        context.drawImage(this.videoElement, dx, dy, dw, dh);
    }
}

export { VideoElementPlayer, VideoPolyfillPlayer };
