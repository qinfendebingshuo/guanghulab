export declare const apiName = "internal.coap.sendMessage";
/**
 * 局域网传输coap包 请求参数定义
 * @apiName internal.coap.sendMessage
 */
export interface IInternalCoapSendMessageParams {
    /** 和设备端约定的id */
    id: number;
    /** 和设备端约定的method */
    method: string;
    /** 约定的coap协议版本号 */
    version: string;
    params: {
        /** 给设备配置的WiFi */
        ssid: string;
        /** ssid的密码，可选，开放网络不需要密码，不传该字段 */
        passwd?: string;
        /** 加密因子 */
        random: string;
        /** 静态ip信息，可选，不需要配置静态ip时不传，需要配置静态ip  */
        ipInfo?: {
            /** 静态ip地址 */
            ip: string;
            /** 子网掩码 */
            subnetMask: string;
            /** 网关地址 */
            gateway: string;
            /** 首选dns */
            preferredDNS: string;
            /** 备选dns */
            optionalDNS: string;
        };
    };
}
/**
 * 局域网传输coap包 返回结果定义
 * @apiName internal.coap.sendMessage
 */
export interface IInternalCoapSendMessageResult {
}
/**
 * 局域网传输coap包
 * @apiName internal.coap.sendMessage
 * @supportVersion ios: 4.6.34 android: 4.6.34
 */
export declare function sendMessage$(params: IInternalCoapSendMessageParams): Promise<IInternalCoapSendMessageResult>;
export default sendMessage$;
