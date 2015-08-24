var WIDTH = 2000;
var HEIGHT = 200;
var STEP = 1;
var VID_STEP = 1;
var video;
var context;


var CombinedSlitScan = class CombinedSlitScan {
  constructor(vid, remote_vid){
    this.video = vid;
    this.remote = remote_vid;
    var canvas = document.createElement('canvas');
    this.context = canvas.getContext('2d');
    canvas.height = HEIGHT*3;
    canvas.width = WIDTH;
    this.canvas = canvas;
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
    var vidHeight = this.video.videoHeight;
    console.log(vidHeight);
     this.context.drawImage(this.video, this.vidIndex, 0, STEP, vidHeight, this.outIndex, 0, STEP, HEIGHT);
      this.context.drawImage(this.remote, this.vidIndex, 0, STEP, vidHeight, this.outIndex, HEIGHT, STEP, HEIGHT);
     
     if(this.outIndex%2==0){
       this.context.drawImage(this.canvas, this.outIndex, 0, STEP, HEIGHT, this.outIndex, HEIGHT*2, STEP, HEIGHT);
     } else {
       this.context.drawImage(this.canvas, this.outIndex, HEIGHT, STEP, HEIGHT, this.outIndex, HEIGHT*2, STEP, HEIGHT);
     }
    
      
        this.outIndex += STEP;
       // vidIndex += VID_STEP;
        if(this.outIndex > WIDTH) this.outIndex = 0;
    
    //if(vidIndex > video.videoWidth) vidIndex = 0;
      
      //  setTimeout(this.addFrame, 1000);
      //  console.log("vid index " + this.vidIndex + " out index " + this.outIndex);
  }
}


export default CombinedSlitScan;