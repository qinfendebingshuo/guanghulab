import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取设备id 请求参数定义
 * @apiName getDeviceId
 */
export interface IUnionGetDeviceIdParams extends ICommonAPIParams {
}
/**
 * 获取设备id 返回结果定义
 * @apiName getDeviceId
 */
export interface IUnionGetDeviceIdResult {
    oaid: string;
    android_id: string;
}
/**
 * 获取设备id
 * @apiName getDeviceId
 */
export declare function getDeviceId$(params: IUnionGetDeviceIdParams): Promise<IUnionGetDeviceIdResult>;
export default getDeviceId$;
