export type VisibilityType = 'ONLY_ME' | 'EVERYONE' 
export const visibilityType: VisibilityType[] = ['ONLY_ME', 'EVERYONE'];
export const flashcardFilterableFields = [
    'searchTerm',
    'title',
    'studentId',
    'isApproved',
    'visibility',
    'categoryGroup',
    'categoryType',
    'categoryDivision',
    'categoryUniversityType',
    'categoryUniversityName',
    'categoryChapter',
    'categorySubject',
    'categoryJobType',
    'categoryJobName',
    'categoryUnit',
    "categoryLesson",
  ];

  export const flashcardSearchableFields = [
    'title',
  ];