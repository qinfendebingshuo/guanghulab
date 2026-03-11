import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取uuid 请求参数定义
 * @apiName getDeviceUUID
 */
export interface IUnionGetDeviceUUIDParams extends ICommonAPIParams {
}
/**
 * 获取uuid 返回结果定义
 * @apiName getDeviceUUID
 */
export interface IUnionGetDeviceUUIDResult {
    uuid: string;
}
/**
 * 获取uuid
 * @apiName getDeviceUUID
 */
export declare function getDeviceUUID$(params: IUnionGetDeviceUUIDParams): Promise<IUnionGetDeviceUUIDResult>;
export default getDeviceUUID$;
