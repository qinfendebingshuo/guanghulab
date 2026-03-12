import { ICommonAPIParams } from '../../constant/types';
/**
 * 打开系统设置 请求参数定义
 * @apiName getSystemSettings
 */
export interface IUnionGetSystemSettingsParams extends ICommonAPIParams {
    data: string;
    param: string;
    action: string;
}
/**
 * 打开系统设置 返回结果定义
 * @apiName getSystemSettings
 */
export interface IUnionGetSystemSettingsResult {
}
/**
 * 打开系统设置
 * @apiName getSystemSettings
 */
export declare function getSystemSettings$(params: IUnionGetSystemSettingsParams): Promise<IUnionGetSystemSettingsResult>;
export default getSystemSettings$;
