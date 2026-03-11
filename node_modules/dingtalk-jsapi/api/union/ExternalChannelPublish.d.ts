import { ICommonAPIParams } from '../../constant/types';
/**
 * 三方写入智能助手通道 请求参数定义
 * @apiName ExternalChannelPublish
 */
export interface IUnionExternalChannelPublishParams extends ICommonAPIParams {
    data: string;
    eventName: string;
    namespace: string;
}
/**
 * 三方写入智能助手通道 返回结果定义
 * @apiName ExternalChannelPublish
 */
export interface IUnionExternalChannelPublishResult {
}
/**
 * 三方写入智能助手通道
 * @apiName ExternalChannelPublish
 */
export declare function ExternalChannelPublish$(params: IUnionExternalChannelPublishParams): Promise<IUnionExternalChannelPublishResult>;
export default ExternalChannelPublish$;
