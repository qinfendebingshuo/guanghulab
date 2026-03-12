export declare const apiName = "internal.interactiveCard.sendAction";
/**
 * 动态卡片发送交互事件 请求参数定义
 * @apiName internal.interactiveCard.sendAction
 */
export interface IInternalInteractiveCardSendActionParams {
    cardInstanceId: number;
    cardAction: {
        /** 交互Id */
        actionId: string;
        /** 交互类型 0:同步; 1:异步 */
        actionType?: number;
        /** 交互内容 */
        actionData?: string;
        /** 加载文案 */
        beginActionText?: string;
        /** 成功文案 */
        successActionText?: string;
        /** 本地缓存数据 */
        localData?: string;
        /** 本地缓存数据类型 0:内存; 1:DB */
        localDataCacheType?: string;
    };
}
/**
 * 动态卡片发送交互事件 返回结果定义
 * @apiName internal.interactiveCard.sendAction
 */
export interface IInternalInteractiveCardSendActionResult {
    cardInfo: {
        /** 卡片Id */
        cardInstanceId: number;
        /** 小程序Id */
        miniAppId: string;
        /** 卡片数据 */
        cardData: string;
        /** 卡片私有数据 */
        privateCardData: string;
        /** 卡片版本 */
        version: number;
        /** 投放平台 */
        distPlatform: string;
        /** 平台Id */
        platformBizId: string;
        /** 小程序组件名 */
        widgetName: string;
        /** 卡片本地数据 */
        localData: string;
    };
}
/**
 * 动态卡片发送交互事件
 * @apiName internal.interactiveCard.sendAction
 * @supportVersion ios: 4.7.8 android: 4.7.8
 * @author android: 卧岩, iOS: 鱼非
 */
export declare function sendAction$(params: IInternalInteractiveCardSendActionParams): Promise<IInternalInteractiveCardSendActionResult>;
export default sendAction$;
