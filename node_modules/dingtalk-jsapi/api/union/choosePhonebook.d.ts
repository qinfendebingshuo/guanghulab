import { ICommonAPIParams } from '../../constant/types';
/**
 * 选取手机通讯录 请求参数定义
 * @apiName choosePhonebook
 */
export interface IUnionChoosePhonebookParams extends ICommonAPIParams {
    title: string;
    maxUsers: number;
    multiple: boolean;
    limitTips: string;
}
/**
 * 选取手机通讯录 返回结果定义
 * @apiName choosePhonebook
 */
export interface IUnionChoosePhonebookResult {
    name: string;
    mobile: string;
    mediaId: string;
}
/**
 * 选取手机通讯录
 * @apiName choosePhonebook
 */
export declare function choosePhonebook$(params: IUnionChoosePhonebookParams): Promise<IUnionChoosePhonebookResult>;
export default choosePhonebook$;
