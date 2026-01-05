import { Book, BookStatus, Loan, User } from './types';

export const CURRENT_USER: User = {
  id: 'u123',
  name: 'Alex Johnson',
  avatarUrl: 'https://picsum.photos/id/64/200/200',
  role: 'Student'
};

export const MOCK_BOOKS: Book[] = [
  {
    id: '1',
    title: 'Architectural Abstracts',
    author: 'Dr. Evelyn Carter',
    category: 'Architecture',
    coverUrl: 'https://picsum.photos/seed/arch/400/600',
    status: BookStatus.AVAILABLE,
    popularity: 85,
    copiesAvailable: 3,
    totalCopies: 5,
    description: 'A deep dive into modern brutalism and its impact on East African skylines.'
  },
  {
    id: '2',
    title: 'Quantum Computing Logic',
    author: 'Prof. Alan Turing II',
    category: 'Computer Science',
    coverUrl: 'https://picsum.photos/seed/tech/400/600',
    status: BookStatus.WAITLIST,
    popularity: 98,
    copiesAvailable: 0,
    totalCopies: 2,
    description: 'Foundational principles of qubits and superposition for undergraduates.'
  },
  {
    id: '3',
    title: 'The Misty Mountains of AI',
    author: 'Sarah Connor',
    category: 'Artificial Intelligence',
    coverUrl: 'https://picsum.photos/seed/ai/400/600',
    status: BookStatus.AVAILABLE,
    popularity: 45,
    copiesAvailable: 8,
    totalCopies: 10,
    description: 'Exploring the ethical landscapes of generative models.'
  },
  {
    id: '4',
    title: 'Clinical Psychology',
    author: 'Sigmund F.',
    category: 'Psychology',
    coverUrl: 'https://picsum.photos/seed/mind/400/600',
    status: BookStatus.AVAILABLE,
    popularity: 72,
    copiesAvailable: 2,
    totalCopies: 4,
    description: 'Modern approaches to cognitive behavioral therapy.'
  },
  {
    id: '5',
    title: 'Sustainable Economics',
    author: 'Wangari Maathai',
    category: 'Economics',
    coverUrl: 'https://picsum.photos/seed/eco/400/600',
    status: BookStatus.BORROWED,
    popularity: 90,
    copiesAvailable: 0,
    totalCopies: 6,
    description: 'Green economy strategies for developing nations.'
  },
  {
    id: '6',
    title: 'Advanced Calculus',
    author: 'Newton L.',
    category: 'Mathematics',
    coverUrl: 'https://picsum.photos/seed/math/400/600',
    status: BookStatus.AVAILABLE,
    popularity: 30,
    copiesAvailable: 15,
    totalCopies: 15,
    description: 'Rigorous derivation of multivariable theorems.'
  }
];

export const MOCK_LOANS: Loan[] = [
  {
    id: 'l1',
    book: MOCK_BOOKS[4],
    checkoutDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2), // Due in 2 days
    isOverdue: false
  },
  {
    id: 'l2',
    book: MOCK_BOOKS[1],
    checkoutDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15), // 15 days ago
    dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1), // Due yesterday
    isOverdue: true,
    fineAmount: 150
  }
];
