import { ICommonAPIParams } from '../../constant/types';
/**
 * 打开应用 请求参数定义
 * @apiName openMicroApp
 */
export interface IUnionOpenMicroAppParams extends ICommonAPIParams {
    appId: string;
    corpId: string;
    agentId: string;
}
/**
 * 打开应用 返回结果定义
 * @apiName openMicroApp
 */
export interface IUnionOpenMicroAppResult {
}
/**
 * 打开应用
 * @apiName openMicroApp
 */
export declare function openMicroApp$(params: IUnionOpenMicroAppParams): Promise<IUnionOpenMicroAppResult>;
export default openMicroApp$;
