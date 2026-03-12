export declare const apiName = "internal.interactiveCard.getCardInfo";
/**
 * 获取交互动态卡片信息 请求参数定义
 * @apiName internal.interactiveCard.getCardInfo
 */
export interface IInternalInteractiveCardGetCardInfoParams {
    /** 交互动态卡片Id */
    cardInstanceId: number;
    /** 业务平台，0: IM (4.7.16以上版本支持) */
    platform: number;
    /** 业务Id，用来鉴权，当平台是IM的时候，platformBizId设置为messageId (4.7.16以上版本支持) */
    platformBizId: string;
}
/**
 * 获取交互动态卡片信息 返回结果定义
 * @apiName internal.interactiveCard.getCardInfo
 */
export interface IInternalInteractiveCardGetCardInfoResult {
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
 * 获取交互动态卡片信息
 * @apiName internal.interactiveCard.getCardInfo
 * @supportVersion ios: 4.7.8 android: 4.7.8
 * @author android: 卧岩, iOS: 鱼非
 */
export declare function getCardInfo$(params: IInternalInteractiveCardGetCardInfoParams): Promise<IInternalInteractiveCardGetCardInfoResult>;
export default getCardInfo$;
