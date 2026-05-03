import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {


  private isLoading=signal(false);
  show(){
    this.isLoading.set(true);
  }

  hide(){
    this.isLoading.set(false);
  }

  get loading(){
    return this.isLoading();
  }
}
