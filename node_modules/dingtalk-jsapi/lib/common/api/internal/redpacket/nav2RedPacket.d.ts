export declare const apiName = "internal.redpacket.nav2RedPacket";
/**
 * 红包组件 请求参数定义
 * @apiName internal.redpacket.nav2RedPacket
 */
export interface IInternalRedpacketNav2RedPacketParams {
    [key: string]: any;
}
/**
 * 红包组件 返回结果定义
 * @apiName internal.redpacket.nav2RedPacket
 */
export interface IInternalRedpacketNav2RedPacketResult {
    [key: string]: any;
}
/**
 * 红包组件
 * @apiName internal.redpacket.nav2RedPacket
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function nav2RedPacket$(params: IInternalRedpacketNav2RedPacketParams): Promise<IInternalRedpacketNav2RedPacketResult>;
export default nav2RedPacket$;
