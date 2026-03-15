export declare const apiName = "device.notification.getNotificationStatus";
/**
 * 获取客户端的通知状态开关是否打开 请求参数定义
 * @apiName device.notification.getNotificationStatus
 */
export interface IDeviceNotificationGetNotificationStatusParams {
}
/**
 * 获取客户端的通知状态开关是否打开 返回结果定义
 * @apiName device.notification.getNotificationStatus
 */
export interface IDeviceNotificationGetNotificationStatusResult {
    /** 系统通知开关是否打开 */
    system_notification: boolean;
    /** 接受新消息通知是否打开 */
    receive_msg_notification: boolean;
    /** 具体消息通知 */
    msg_notification: {
        /** 普通消息开关是否打开 */
        normal: boolean;
        /** DING消息开关是否打开 */
        ding: boolean;
        /** 特别关注人消息开关是否打开 */
        concern: boolean;
        /** At我的消息开关是否打开 */
        at_me: boolean;
        /** 红包消息开关是否打开 */
        red_packet: boolean;
        /** 连续DING消息开关是否打开 */
        ding_long: boolean;
    };
}
/**
 * 获取客户端的通知状态开关是否打开
 * @apiName device.notification.getNotificationStatus
 * @supportVersion ios: 5.1.41 android: 5.1.41
 * @author Android：彦海, iOS：新鹏
 */
export declare function getNotificationStatus$(params: IDeviceNotificationGetNotificationStatusParams): Promise<IDeviceNotificationGetNotificationStatusResult>;
export default getNotificationStatus$;
