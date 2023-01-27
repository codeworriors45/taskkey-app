import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImgFallbackDirective } from './appImgFallback';
import { ClickOutsideDirective } from './outsideClick';



@NgModule({
  declarations: [
    ImgFallbackDirective,
    ClickOutsideDirective
  ],
  imports: [
    CommonModule,
  ],
  exports: [
    ImgFallbackDirective,
    ClickOutsideDirective
  ]
})
export class SharedModule { }
