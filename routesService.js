import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase-config';

const routesRef = collection(db, 'routes');

export function subscribeToRoutes(callback) {
  return onSnapshot(routesRef, snapshot => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
}

export function addRoute(route) {
  return addDoc(routesRef, route);
}

export function updateRoute(id, data) {
  return updateDoc(doc(db, 'routes', id), data);
}

export function deleteRoute(id) {
  return deleteDoc(doc(db, 'routes', id));
}
