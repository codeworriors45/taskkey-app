import { Component, OnInit, OnDestroy, Input, ElementRef, ViewChild, HostListener } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router, NavigationEnd, RouterEvent } from '@angular/router';
import { AngularFireStorage } from "@angular/fire/storage";
import { Store } from '@ngxs/store';
import { Subject } from 'rxjs';
import { takeUntil, finalize, filter } from 'rxjs/operators';
import { AngularFirestore } from '@angular/fire/firestore';
import * as moment from 'moment';

import { CardsState } from '../../../stateManagement/cards/cards.state';
import { SetFileStats } from '../../../stateManagement/cards/cards.action';
import { FirebaseUserService } from '../../../services/firebaseUser.service';
import { FirebaseProjectService } from '../../../services/firebaseProject.service';
import { FirebaseFileService } from '../../../services/firebaseFile.service';
import { WindowService } from '../../../shared/window.service';
import { ActivitylogsService } from '../../../services/activitylogs.service';
import { ACTION_MAPPER, ACTION_TITLE_MAPPER } from '../../../interfaces/activity.action'
import { ACTIVITY_IDENTIFIER } from '../../../interfaces/activity.identifiers'

@Component({
  selector: 'app-files',
  templateUrl: './files.component.html',
  styleUrls: ['./files.component.scss']
})
export class FilesComponent implements OnInit, OnDestroy {
  @Input() projectId: string = '';
  currentUser: any;
  sortBy = '';
  sortOrder = 1;
  filterApplied = false;
  uploadedFiles = [];
  files = [];
  filteredFiles = [];
  selectedFile: any;
  startFileUpload = true;
  fileUploadStatus = 0;
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  @ViewChild('fileDropRef') fileDropRef: ElementRef;
  @ViewChild('fileContainer') fileContainer: ElementRef;
  @ViewChild('fullImgView') fullImgView: ElementRef;
  dataLoadedOnLoad = false;
  participants = [];
  viewMode = 'grid';
  clickedViewModeBtn = false;

  filterOptions = {
    type: [],
    participants: []
  };
  fileTypeArr = [];

  showFileLoadingIndicator = false;
  availableWidth = 0;
  maxHeight = 0;
  maxWidthCalculated = false;
  getFileContainerElementRefInterval: any;
  selectedFile_fullView: any;
  showFullImage = false;
  setFullImgViewMaxHeightInterval: any;
  fullImgView_maxHeight = 0;
  showFullImgLoadingIndicator = false;
  availableWidth_fullView = 0;

  constructor(
    private store: Store,
    private router: Router,
    private sanitizer: DomSanitizer,
    private ngFireStorage: AngularFireStorage,
    private ngFirestore: AngularFirestore,
    private firebaseUserService: FirebaseUserService,
    private firebaseProjectService: FirebaseProjectService,
    private firebaseFileService: FirebaseFileService,
    private window: WindowService,
    private activitylogsService: ActivitylogsService
  ) {
    const subs = this.firebaseUserService.getCurrentUser().subscribe((userData) => {
      subs.unsubscribe();
      this.currentUser = userData;
      if (this.dataLoadedOnLoad) {
        //this.setFileStats();
      }
    }, err => {
      subs.unsubscribe();
      console.log(err);
    });

    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntil(this.subscriptionDestroyed$)).subscribe((endUrl: NavigationEnd) => {
      const currentUrl = endUrl.urlAfterRedirects;
      if (currentUrl.indexOf('app/dashboard/c/') != -1) {
        const foundAt = currentUrl.indexOf('/c/');
        if (currentUrl.indexOf('/t/') == -1) {
          this.projectId = currentUrl.slice(foundAt + 3);
        } else {
          const index = currentUrl.indexOf('/t/');
          this.projectId = currentUrl.slice(foundAt + 3, index);
        }
      }
      if (this.dataLoadedOnLoad) {
        this.loadFiles();
      }
    });
  }

  @HostListener("window:keyup", ["$event"])
  keyupHandler(event) {
    if((event.key == 'ArrowRight' || event.key == 'ArrowLeft') && this.showFullImage) {
      if(event.key == 'ArrowRight') {
        this.showNextImgOrPDF();
      } else {
        this.showPrevImgOrPDF();
      }
    }
  }

  ngOnInit(): void {
    this.store.select(CardsState.getProjectById(this.projectId)).subscribe(async (card) => {
      const allParticipant = [];
      for (let participant of card.participants) {
        const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(participant.id)
        allParticipant.push({ ...user, ...participant });
      }

      const mappedParticipants = allParticipant.map((r_participant) => {
        const serchedParticipant = this.participants.find(participant => participant.userId == r_participant.userId);
        if (serchedParticipant && serchedParticipant.selected) {
          return { ...r_participant, selected: true };
        }
        return { ...r_participant, selected: false };
      })
      this.participants = mappedParticipants;
      this.filterOptions.participants = [...mappedParticipants];
      this.mapParticipantWithFiles();
      this.filterFiles();
    });

    this.loadFiles();
  }

  loadFiles() {
    if (this.firebaseFileService.getFilesByProjectIdSub) {
      this.firebaseFileService.getFilesByProjectIdSub.unsubscribe();
    }
    this.firebaseFileService.getFilesByProjectIdSub = this.firebaseFileService.getAndListenAllFilesById(this.projectId).subscribe((files) => {
      this.dataLoadedOnLoad = true;

      const mappedFiles = files.map(file => {
        file = this.mapDateTimeNSize(file);
        const re = /(\.jpg|\.jpeg|\.png|\.heic)$/i;
        //console.log('loadFiles() ', file.ext, re.test('.' + file.ext))
        if (re.test('.' + file.ext)) {
          file.trustedThumbUrl = this.sanitizer.bypassSecurityTrustUrl('data:image/png;base64,' + file.thumbUrl);
        }
        const type = this.getFileTypeByExtension(file.ext);
        //console.log(type)
        return { ...file, type: type, fullImageLoaded: false };
      });
      this.uploadedFiles = mappedFiles;
      if (this.uploadedFiles.length > 0) {
        this.startFileUpload = false;
      }
      if (this.currentUser) {
        //this.setFileStats();
      }
      this.mapParticipantWithFiles();
      this.filterFiles();
      //console.log('files: ', this.filteredFiles);
    });
  }

  setFileStats() {
    let newFile = 0;
    this.uploadedFiles.forEach(file => {
      if (!file.readStatus || !file.readStatus[this.currentUser.userId]) {
        newFile = newFile + 1;
      }
    });

    const fileStats = {
      total: this.uploadedFiles.length,
      new: newFile
    }
    this.store.dispatch(new SetFileStats(fileStats))
  }

  async mapParticipantWithFiles() {
    if (this.participants.length > 0 && this.uploadedFiles.length > 0) {
      for (let file of this.uploadedFiles) {
        const participant = this.participants.find(p => p.userId == file.createdBy);
        if (participant) {
          file.createdByUser = participant;
        } else {
          const user = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(file.createdBy);
          file.createdByUser = user;
        }
      }
    }
  }

  mapDateTimeNSize(file) {
    const size = this.formatBytes(file.size, 2);
    file.sizeToDisplay = size;
    let timestamp = null;
    let miliseconds = 0;
    if (file.timestamp) {
      miliseconds = parseInt((file.timestamp.seconds * 1000).toString()) + parseInt((file.timestamp.nanoseconds / 1000000).toString());

      timestamp = moment(miliseconds).calendar();
      if (timestamp.indexOf('/') !== -1) {
        timestamp = moment(miliseconds).format("D MMM YYYY [at] h:mm a");
      }
    }
    file.miliseconds = miliseconds;
    file.dateToDisplay = timestamp;
    //console.log(file.sizeToDisplay, file.dateToDisplay);
    return file;
  }

  initiateFileUpload() {
    this.startFileUpload = true;
    this.fileUploadStatus = 0;
    setTimeout(() => {
      this.fileDropRef.nativeElement.value = "";
    }, 200);
  }

  sortFiles() {
    let sortBy = this.sortBy;

    if (sortBy == '') {
      sortBy = 'date';
    }
    if (sortBy == 'date') {
      sortBy = 'miliseconds';
    }
    if (sortBy == 'type') {
      sortBy = 'ext';
    }

    this.filteredFiles.sort((a, b) => {
      let result = (a[sortBy] > b[sortBy]) ? -1 : (a[sortBy] < b[sortBy]) ? 1 : 0;
      return result * this.sortOrder;
    });
  }

  toogleSortOrder() {
    this.sortOrder = -1 * this.sortOrder;
    if (this.sortBy == '') {
      this.sortBy = 'date';
    }
    this.sortFiles();
  }

  preventClose(event: MouseEvent) {
    event.stopImmediatePropagation();
  }

  openFiletrDropDown(filterDropdown) {
    const mappedParticipants = this.participants.map(partipant => {
      const searchedParticipant = this.filterOptions.participants.find(f_partipant => f_partipant.userId == partipant.userId);
      return { ...searchedParticipant, selected: searchedParticipant.selected ? true : false }
    })
    this.participants = [...mappedParticipants];
    this.fileTypeArr = [...this.filterOptions.type];
    filterDropdown.show();
  }

  applyFiletrDropDown() {
    const mappedParticipants = this.filterOptions.participants.map(f_partipant => {
      const searchedParticipant = this.participants.find(partipant => f_partipant.userId == partipant.userId);
      return { ...searchedParticipant, selected: searchedParticipant.selected ? true : false }
    })
    this.filterOptions.participants = [...mappedParticipants];
    this.filterOptions.type = [...this.fileTypeArr];
    //console.log(this.filterOptions)
    this.filterFiles();
    this.filterApplied = true;
  }

  filterFiles() {
    //this.filteredFiles = this.uploadedFiles;
    this.filteredFiles = this.uploadedFiles.filter((file) => {
      let participantFoundInFilter = false;

      const selectedParticipantInFilterOpt = this.filterOptions.participants.filter(participant => participant.selected);

      selectedParticipantInFilterOpt.forEach(filterParticipant => {
        if (file.createdBy == filterParticipant.userId) {
          participantFoundInFilter = true;
        }
      });
      if (selectedParticipantInFilterOpt.length == 0) {
        participantFoundInFilter = true;
      }

      return (this.filterOptions.type.length > 0 ? this.filterOptions.type.indexOf(file.type) != -1 : true) && participantFoundInFilter;
    });
    this.sortFiles();
  }

  resetFilterDropDown() {
    const mappedParticipants = this.participants.map((participant) => {
      return { ...participant, selected: false };
    });
    this.participants = [...mappedParticipants];
    this.filterOptions.participants = [...mappedParticipants];
    this.filterOptions.type = [];
    this.fileTypeArr = [];
    this.filteredFiles = this.uploadedFiles;
    this.filterApplied = false;
    this.sortFiles();
  }

  toogleSelectedTypeForFilter(type) {
    const index = this.fileTypeArr.indexOf(type);
    if (index == -1) {
      this.fileTypeArr.push(type)
    } else {
      this.fileTypeArr.splice(index, 1);
    }
  }

  openFileOperationDropDown(dropDown) {
    //event.stopPropagation();
    dropDown.show();
  }

  toogleViewMode() {
    this.viewMode = this.viewMode == 'list' ? 'grid' : 'list';
    this.clickedViewModeBtn = true;
  }

  shareFile(file) {

  }

  openInNewTab(file) {
    window.open(file.url, "_blank");
  }

  _downloadFile(file) {
    let link = document.createElement('a');
    link.href = file.url;
    link.download = 'file.pdf';
    link.dispatchEvent(new MouseEvent('click'));
  }

  downloadFile(file) {
    const fileURL = file.url;
    const fileName = file.name + '.' + file.ext;
    // for non-IE
    if (!(window as any).ActiveXObject) {
      var save = document.createElement('a');
      save.href = fileURL;
      save.target = '_blank';
      save.download = fileName || 'unknown';

      var evt = new MouseEvent('click', {
        'view': window,
        'bubbles': true,
        'cancelable': false
      });
      save.dispatchEvent(evt);

      (window.URL || window.webkitURL).revokeObjectURL(save.href);
    }

    // for IE < 11
    else if (!!(window as any).ActiveXObject && document.execCommand) {
      var _window = window.open(fileURL, '_blank');
      _window.document.close();
      _window.document.execCommand('SaveAs', true, fileName || fileURL)
      _window.close();
    }
  }

  renameFile(file) {
    const oldName = file.name.trim();
    const name = prompt('Please Enter New File Name', file.name);
    const trimedName = name.trim();
    if (trimedName != '') {
      const data = {
        name: trimedName
      }
      this.ngFirestore.collection('projects').doc(this.projectId).collection('files').doc(file.id).set(data, { merge: true }).then(() => {
        this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.FILERENAMED.replace('$name', oldName), ACTIVITY_IDENTIFIER.FILE_RENAMED, this.currentUser.userId, ACTION_TITLE_MAPPER['file_renamed'].replace(/[{()}]/g, '').replace('name', file.name).replace('newName', trimedName), 11).subscribe(res => { })
        if (this.selectedFile.id == file.id) {
          this.sortFiles();
        }
      });
    } else {
      alert('File name can not be empty!')
    }
  }

  isOwnerOfFile(file) {
    if (file.createdBy == this.currentUser.userId) {
      return true;
    }
    return false;
  }

  deleteFile(file) {
    const allowed = this.isOwnerOfFile(file);
    if (!allowed) {
      alert('Can not delete file uploaded by another user!');
      return;
    }
    const r = confirm("Are you sure to delete file?");
    if (r == true) {
      this.ngFirestore.collection('projects').doc(this.projectId).collection('files').doc(file.id).delete().then(() => {
        let uploadTitle
        if (this.getFileTypeByExtension(file.ext) == 'img') {
          uploadTitle = 'an Image'
        } else {
          uploadTitle = file.name
        }
        this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.FILEDELETED, ACTIVITY_IDENTIFIER.FILE_DELETED, this.currentUser.userId, uploadTitle, 11).subscribe(res => { })
        if (this.selectedFile && this.selectedFile.id == file.id) {
          this.selectedFile = null;
          this.markUploadCompleted();
        }
      });
    }
  }

  previewFile(file) {
    this.markUploadCompleted();
    this.showFileLoadingIndicator = true;
    if (this.selectedFile) {
      if (this.selectedFile.id == file.id) {
        this.showFileLoadingIndicator = false;
      }
    }
    this.selectedFile = file;
    this.getFileContainerHeightWidth_N_setLoadingFalseIfImg();
    this.setReadStatusIfNot(file);
  }

  fileLoadedEvtHandler(evt) {
    this.showFileLoadingIndicator = false;
  }

  previewNextFile() {
    const filteredFilesNum = this.filteredFiles.length;
    if (filteredFilesNum > 0) {
      const currentFileIndex = this.filteredFiles.findIndex(file => file.id == this.selectedFile.id);
      if (currentFileIndex != -1) {
        if (currentFileIndex == (filteredFilesNum - 1)) {
          this.selectedFile = this.filteredFiles[0];
        } else {
          this.selectedFile = this.filteredFiles[currentFileIndex + 1];
        }
      } else {
        this.selectedFile = this.filteredFiles[0];
      }
      this.showFileLoadingIndicator = false;
      if (filteredFilesNum > 1) {
        this.showFileLoadingIndicator = true;
      }

      this.getFileContainerHeightWidth_N_setLoadingFalseIfImg();
      this.setReadStatusIfNot(this.selectedFile);
    }
  }

  previewPrevFile() {
    const filteredFilesNum = this.filteredFiles.length;
    if (filteredFilesNum > 0) {
      const currentFileIndex = this.filteredFiles.findIndex(file => file.id == this.selectedFile.id);
      if (currentFileIndex != -1) {
        if (currentFileIndex == 0) {
          this.selectedFile = this.filteredFiles[filteredFilesNum - 1];
        } else {
          this.selectedFile = this.filteredFiles[currentFileIndex - 1];
        }
      } else {
        this.selectedFile = this.filteredFiles[filteredFilesNum - 1];
      }

      this.showFileLoadingIndicator = false;
      if (filteredFilesNum > 1) {
        this.showFileLoadingIndicator = true;
      }

      this.getFileContainerHeightWidth_N_setLoadingFalseIfImg();
      this.setReadStatusIfNot(this.selectedFile);
    }
  }

  getFileContainerHeightWidth_N_setLoadingFalseIfImg() {
    this.maxWidthCalculated = false;

    clearInterval(this.getFileContainerElementRefInterval);
    this.getFileContainerElementRefInterval = setInterval(() => {
      if (this.fileContainer) {
        clearInterval(this.getFileContainerElementRefInterval);

        this.availableWidth = this.fileContainer.nativeElement.offsetWidth;
        this.maxHeight = this.fileContainer.nativeElement.offsetHeight;

        if (this.selectedFile.type == 'img') {
          this.showFileLoadingIndicator = false;
        } else if (this.selectedFile.type == 'pdf') {
          this.maxWidthCalculated = true;
        }
      }
    }, 500);
  }

  showFullImgOrPDF(selectedFile) {
    this.selectedFile_fullView = selectedFile;

    this.showFullImage = true;

    this.showFullImgLoadingIndicator = true;
    this.getFileContainerHeightWidth_fullView();
  }

  getFileContainerHeightWidth_fullView() {
    clearInterval(this.setFullImgViewMaxHeightInterval);
    this.setFullImgViewMaxHeightInterval = setInterval(() => {
      if (this.fullImgView) {
        clearInterval(this.setFullImgViewMaxHeightInterval);

        this.availableWidth_fullView = this.fullImgView.nativeElement.offsetWidth;
        this.fullImgView_maxHeight = this.fullImgView.nativeElement.offsetHeight;

        this.showFullImgLoadingIndicator = false;
      }
    }, 500);
  }

  setReadStatusIfNot(file) {
    if (!file.readStatus || !file.readStatus[this.currentUser.userId]) {
      const data = {};
      const readStatus = {};

      readStatus[this.currentUser.userId] = true;
      data['id'] = file.id;
      data['readStatus'] = readStatus;

      this.ngFirestore.collection('projects').doc(this.projectId).collection('files').doc(file.id).set(data, { merge: true }).then(() => {
        //console.log('set read status done..')
      })
    }
  }

  onFileDropped($event) {
    this.prepareFilesList($event);
  }

  /**
   * handle file from browsing
   */
  fileBrowseHandler(files) {
    this.prepareFilesList(files);
  }

  /**
   * Convert Files list to normal array list
   * @param files (Files List)
   */
  prepareFilesList(files: Array<any>) {
    this.files = [];
    for (const item of files) {
      //this.formatBytes(item.size, 0);
      this.files.push(item);
    }
    const response = this.checkFileSizeAndNumberToAllowUpload(this.files);
    if (!response.allowed) {
      this.fileUploadStatus = -1;
      setTimeout(() => {
        this.fileDropRef.nativeElement.value = "";
      }, 200);
      alert(response.msg);
      return;
    }
    this.fileUploadStatus = 1;
    //this.uploadFilesSimulator(0);
    this.uploadFiles(this.files);
  }

  checkFileSizeAndNumberToAllowUpload(files) {
    const respnse = {
      msg: '',
      allowed: true
    }
    if (files.length > 5) {
      respnse.allowed = false;
      respnse.msg = `Maximum 5 files are allowed to upload!`;
    }
    files.forEach(file => {
      if (file.size > 10485760) {
        respnse.allowed = false;
        respnse.msg = respnse.msg + `${file.name} is not allowed to upload. It is greater than 10 MB!`;
      }
      const validFile = this.checkValidations(file);
      if (!validFile) {
        respnse.allowed = false;
        respnse.msg = respnse.msg + `${file.name} is not allowed to upload!`;
      }
    });

    return respnse;
  }

  async uploadFiles(files) {
    //console.log(files)
    let fileUploadCount = 0;
    for (let file of files) {
      if (this.fileUploadStatus != -1) {
        const fileToUpload = {}
        fileToUpload['url'] = await this.uploadSingleFile(file);
        if (fileToUpload['url']) {
          //console.log(fileToUpload['url']);
          if (this.checkIsImage(file)) {
            fileToUpload['thumbUrl'] = await this.generateBase64Data(file);
            //console.log('-------thumbUrl--------');
            //console.log(fileToUpload)
          }
          fileToUpload['projectId'] = this.projectId;
          const fileNameArr = file.name.split('.');
          const tempNameArr = fileNameArr.splice(0, fileNameArr.length - 1)
          fileToUpload['name'] = tempNameArr.join('.');
          fileToUpload['ext'] = fileNameArr[fileNameArr.length - 1];
          fileToUpload['size'] = file.size;
          fileToUpload['timestamp'] = new Date();

          const userId = this.currentUser.userId;
          fileToUpload['createdBy'] = userId;

          const readStatus = {};
          readStatus[userId] = true;
          fileToUpload['readStatus'] = readStatus;

          const fileId = await this.getFileReference();
          fileToUpload['id'] = fileId;

          //console.log('fileToUpload: ', fileToUpload);
          const response = await this.insertFileDocToDB(fileToUpload);
          if (response == 'success') {
            fileUploadCount = fileUploadCount + 1;
          }
        } else {
          this.fileUploadStatus = -1;
        }
      }
    }

    if (fileUploadCount > 1) {
      this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.FILEBULKUPLOAD.replace('$count', fileUploadCount.toString()), ACTIVITY_IDENTIFIER.FILE_MULTIPLE_UPLOADED, this.currentUser.userId, ACTION_TITLE_MAPPER['file_bulk_upload'].replace(/[{()}]/g, '').replace('$count', fileUploadCount.toString()), 11).subscribe(res => { })
    } else {
      let uploadTitle
      if (this.checkIsImage(files[0])) {
        uploadTitle = 'an Image'
      } else {
        uploadTitle = files[0].name
      }
      this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.FILEUPLOAD, ACTIVITY_IDENTIFIER.FILE_UPLOADED, this.currentUser.userId, uploadTitle, 11).subscribe(res => { })
    }
  }

  checkValidations(file) {
    //var re = /(\.jpg|\.jpeg|\.png|\.pdf|\.doc|\.docx|\.heic)$/i;
    const re = /(\.bat|\.exe)$/i;
    const filenameArr = file.name.split('.');
    //if (!re.exec('.' + filenameArr[filenameArr.length-1])) {
    if (re.test('.' + filenameArr[filenameArr.length - 1])) {
      return false
    } else {
      return true
    }
  }

  checkIsImage(file) {
    var re = /(\.jpg|\.jpeg|\.png|\.heic)$/i;
    const filenameArr = file.name.split('.')
    //console.log('checkIsImage() ', file.name, re.test('.' + filenameArr[filenameArr.length - 1]))
    if (!re.test('.' + filenameArr[filenameArr.length - 1])) {
      return false
    } else {
      return true
    }
  }

  getFileTypeByExtension(ext) {
    const re = /(\.jpg|\.jpeg|\.png|\.heic)$/i;
    //console.log('getFileTypeByExtension() ', ext, re.test('.' + ext))
    if (re.test('.' + ext)) {
      return 'img';
    }
    if (ext == 'pdf' || ext == 'PDF') {
      return 'pdf';
    }
    return 'other';
  }

  uploadSingleFile(file) {
    return new Promise<string>((resolve, reject) => {
      const fileName = file.name;
      const filePath = `files/`;
      const fileRef = this.ngFireStorage.ref(`${filePath}${fileName}`);
      const task = this.ngFireStorage.upload(`${filePath}${fileName}`, file);
      task
        .snapshotChanges()
        .pipe(takeUntil(this.subscriptionDestroyed$))
        .pipe(
          finalize(() => {
            const downloadURL = fileRef.getDownloadURL();
            downloadURL.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(url => {
              if (url) {
                //console.log(url)
                resolve(url)
              } else {
                reject(url)
              }
            });
          })
        ).subscribe(url => {
          if (url) {
            //console.log(url);
          }
        });
    });
  }

  generateBase64Data(file) {
    return new Promise<string>((resolve, reject) => {
      var reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = function (e) {
        var image = new Image();
        image.onload = function (imageEvent) {
          // Resize the image using canvas  
          var canvas = document.createElement('canvas'),
            max_size = 10,
            width = image.width,
            height = image.height;
          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(image, 0, 0, width, height);

          //Getting base64 string;  
          var dataUrl = canvas.toDataURL();
          dataUrl = dataUrl.replace(/^data:image\/(png|jpg|jpeg|heic);base64,/, "")
          resolve(dataUrl)
        }
        image.src = (e.target.result).toString();
      }
    })
  }

  getFileReference() {
    return new Promise<string>((resolve, reject) => {
      this.ngFirestore.collection('projects').doc(this.projectId).collection('files').doc().get().subscribe(res => {
        resolve(res.ref.id)
      })
    })
  }

  insertFileDocToDB(file) {
    return new Promise<string>((resolve, reject) => {
      this.ngFirestore.collection('projects').doc(this.projectId).collection('files').doc(file.id).set(file, { merge: true }).then(() => {
        //console.log('---------file uploaded------------');
        resolve('success');
      }).catch(() => {
        reject('fail')
      })
    });
  }

  markUploadCompleted() {
    if (this.fileDropRef) {
      this.fileDropRef.nativeElement.value = "";
      this.startFileUpload = false;
      this.fileUploadStatus = 0;
    }
  }

  stopPropagation(event) {
    event.stopPropagation();
  }

  hideFullImgView() {
    this.showFullImage = false;
  }

  showNextImgOrPDF() {
    const fullViewFilteredFiles = this.filteredFiles.filter((file) => {
      if(file.type == 'img' || file.type == 'pdf') {
        return true
      }
      return false;
    });

    const filteredFilesNum = fullViewFilteredFiles.length;

    const currentFileIndex = fullViewFilteredFiles.findIndex(file => file.id == this.selectedFile_fullView.id);
    if (currentFileIndex == (filteredFilesNum - 1)) {
      this.selectedFile_fullView = fullViewFilteredFiles[0];
    } else {
      this.selectedFile_fullView = fullViewFilteredFiles[currentFileIndex + 1];
    }

    this.showFullImgLoadingIndicator = false;
    if (filteredFilesNum > 1) {
      this.showFullImgLoadingIndicator = true;
    }
    if(this.showFullImgLoadingIndicator) {
      this.getFileContainerHeightWidth_fullView();
      this.setReadStatusIfNot(this.selectedFile_fullView);
    }      
  }

  showPrevImgOrPDF() {
    const fullViewFilteredFiles = this.filteredFiles.filter((file) => {
      if(file.type == 'img' || file.type == 'pdf') {
        return true
      }
      return false;
    });

    const filteredFilesNum = fullViewFilteredFiles.length;
    const currentFileIndex = fullViewFilteredFiles.findIndex(file => file.id == this.selectedFile_fullView.id);
    
    if (currentFileIndex == 0) {
      this.selectedFile_fullView = fullViewFilteredFiles[fullViewFilteredFiles.length -  1];
    } else {
      this.selectedFile_fullView = fullViewFilteredFiles[currentFileIndex - 1];
    }

    this.showFullImgLoadingIndicator = false;
    if (filteredFilesNum > 1) {
      this.showFullImgLoadingIndicator = true;
    }
    if(this.showFullImgLoadingIndicator) {
      this.getFileContainerHeightWidth_fullView();
      this.setReadStatusIfNot(this.selectedFile_fullView);
    }
  }

  /**
   * format bytes
   * @param bytes (File size in bytes)
   * @param decimals (Decimals point)
   */
  formatBytes(bytes, decimals) {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const dm = decimals <= 0 ? 0 : decimals || 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Simulate the upload process
   */
  uploadFilesSimulator(index: number) {
    setTimeout(() => {
      if (index === this.files.length) {
        return;
      } else {
        const progressInterval = setInterval(() => {
          if (this.files[index].progress === 100) {
            clearInterval(progressInterval);
            this.uploadFilesSimulator(index + 1);
          } else {
            this.files[index].progress += 5;
          }
        }, 200);
      }
    }, 1000);
  }

  ngOnDestroy() {
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
    this.firebaseFileService.getFilesByProjectIdSub.unsubscribe();
    clearInterval(this.getFileContainerElementRefInterval);
    clearInterval(this.setFullImgViewMaxHeightInterval);
  }
}
