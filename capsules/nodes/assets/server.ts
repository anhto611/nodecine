import { fetchPicture, readPage, searchCommons } from '@/server/contracts/web';

export const assetsServices = { 'assets/read-page': readPage, 'assets/fetch-picture': fetchPicture, 'assets/search-commons': searchCommons };
