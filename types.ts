export enum BookStatus {
  AVAILABLE = 'AVAILABLE',
  WAITLIST = 'WAITLIST',
  BORROWED = 'BORROWED'
}

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  coverUrl: string;
  status: BookStatus;
  popularity: number; // 0-100
  copiesAvailable: number;
  totalCopies: number;
  description: string;
  callNumber?: string;
  shelfLocation?: string;
  floorNumber?: number;
  softCopyUrl?: string;
  hasSoftCopy?: boolean;
  isbn?: string;
  publishedYear?: number;
  publisher?: string;
}

export interface Loan {
  id: string;
  book: Book;
  checkoutDate: Date;
  dueDate: Date;
  isOverdue: boolean;
  fineAmount?: number;
}

export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'Student' | 'Lecturer' | 'Faculty' | 'Admin';
  course?: string;
  email?: string;
  admissionNo?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export type BorrowRequestStatus = 'pending' | 'approved' | 'rejected';

export interface BorrowRequest {
  id: string;
  userId: string;
  bookId: string;
  status: BorrowRequestStatus;
  rejectionReason?: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  // Joined data from related tables
  userName?: string;
  userAdmissionNo?: string;
  bookTitle?: string;
  bookAuthor?: string;
  bookCoverUrl?: string;
  copiesAvailable?: number;
}
