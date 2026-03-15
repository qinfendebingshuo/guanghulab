import { ICommonAPIParams } from '../../constant/types';
/**
 * 发起在线课堂	 请求参数定义
 * @apiName createLiveClassRoom
 */
export interface IUnionCreateLiveClassRoomParams extends ICommonAPIParams {
    startParam: {
        liveUuid: string;
    };
}
/**
 * 发起在线课堂	 返回结果定义
 * @apiName createLiveClassRoom
 */
export interface IUnionCreateLiveClassRoomResult {
}
/**
 * 发起在线课堂
 * @apiName createLiveClassRoom
 */
export declare function createLiveClassRoom$(params: IUnionCreateLiveClassRoomParams): Promise<IUnionCreateLiveClassRoomResult>;
export default createLiveClassRoom$;
