import { Directive, ElementRef, HostListener, Input, OnInit, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[appImgFallback]'
})
export class ImgFallbackDirective implements OnInit {
  alreadyTried: boolean = false;
  @Input('appImgFallback') imgSrc: string;
  @Input() acrony: string

  constructor(private el: ElementRef) {
  }

  ngOnInit(): void {
    this.alreadyTried = false
  }

  @HostListener('error') onError(){
    // if (!this.alreadyTried) {
      if(this.acrony) {
        const canvas = document.createElement('canvas');
        var context = canvas.getContext("2d");
        canvas.height = 40
        canvas.width = 40
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 20;
        context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
        context.fillStyle = '#7A7879';
        context.fill();
        context.font = "lighter 19px Arial";
        context.fillStyle = "#FFFFFF";
        context.textAlign = "center";
        context.fillText(this.acrony, 20, 28);
        this.el.nativeElement.src = canvas.toDataURL();
      } else {
        this.el.nativeElement.src = this.imgSrc
      }
    // }

    // this.alreadyTried = true
  }
}