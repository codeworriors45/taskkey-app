import { Injectable } from '@angular/core';
import { NgxsFirestore } from '@ngxs-labs/firestore-plugin';
import { Card } from 'src/app/interfaces/card.interface';

@Injectable({ providedIn: 'root' })
export class CardsFirestoreService extends NgxsFirestore<any> {
  protected path = 'projects';
}