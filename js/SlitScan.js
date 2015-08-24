var WIDTH = 2000;
var HEIGHT = 300;
var STEP = 1;
var VID_STEP = 1;
var video;
var context;


var SlitScan = class SlitScan {
	constructor(vid){
		this.video = vid;
		var canvas = document.createElement('canvas');
		this.context = canvas.getContext('2d');
		canvas.height = HEIGHT;
		canvas.width = WIDTH;
		this.outIndex = 0;
		this.vidIndex = 0;
		document.body.insertBefore(canvas, document.body.firstChild);
		console.log("created slit scan");
		console.log(this);
	}

	addFrame(){
		//.log(this);
	//console.log(this.video);
		//console.log(this.context);
		//console.log(video.videoWidth);
		//console.log(this);
		this.vidIndex = this.video.videoWidth/2;
		 this.context.drawImage(this.video, this.vidIndex, 0, STEP, HEIGHT, this.outIndex, 0, STEP, HEIGHT);
	      this.outIndex += STEP;
	     // vidIndex += VID_STEP;
	      if(this.outIndex > WIDTH) this.outIndex = 0;
		
		//if(vidIndex > video.videoWidth) vidIndex = 0;
	    
	    //  setTimeout(this.addFrame, 1000);
	    //  console.log("vid index " + this.vidIndex + " out index " + this.outIndex);
	}
}

export default SlitScan;
