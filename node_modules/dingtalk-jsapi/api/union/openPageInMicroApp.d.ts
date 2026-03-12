import { ICommonAPIParams } from '../../constant/types';
/**
 * 打开应用内页面 请求参数定义
 * @apiName openPageInMicroApp
 */
export interface IUnionOpenPageInMicroAppParams extends ICommonAPIParams {
    name: string;
    params: {
        id: string;
        users: string[];
        corpId: string;
    };
}
/**
 * 打开应用内页面 返回结果定义
 * @apiName openPageInMicroApp
 */
export interface IUnionOpenPageInMicroAppResult {
}
/**
 * 打开应用内页面
 * @apiName openPageInMicroApp
 */
export declare function openPageInMicroApp$(params: IUnionOpenPageInMicroAppParams): Promise<IUnionOpenPageInMicroAppResult>;
export default openPageInMicroApp$;
