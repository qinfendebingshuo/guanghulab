export declare const apiName = "taurus.common.chooseContact";
export declare enum SelectVersionEnum {
    DEFAULT = 1,
    NEW = 2
}
export declare enum PanelTypeEnum {
    GLOBAL_ORG = 1,
    FRIEND = 2,
    GROUP = 4,
    RECOMMEND = 5,
    SPECIAL_ATTENTION = 7,
    LOAD_GROUP_PERSON = 8,
    ORG = 9
}
export declare enum VisibilityCodesEnum {
    PHONE_HIDE = "PHONE_HIDE",
    CHAT_INVALID = "CHAT_INVALID",
    GROUP_CHAT_PULL_INVALID = "GROUP_CHAT_PULL_INVALID",
    APP_DING_INVALID = "APP_DING_INVALID",
    PHONE_DING_INVALID = "PHONE_DING_INVALID",
    SMS_DING_INVALID = "SMS_DING_INVALID",
    AUDIO_VIDEO_HIDE = "AUDIO_VIDEO_HIDE"
}
/**
 * pc端选人组件，该接口需要鉴权 请求参数定义
 * @apiName taurus.common.chooseContact
 */
export interface ITaurusCommonChooseContactParams {
    multiple?: boolean;
    users?: string[];
    max?: number;
    responseUserOnly?: boolean;
    limitTips?: string;
    title?: string;
    pickedUsers?: string[];
    requiredUsers?: string[];
    disabledUsers?: string[];
    selectVersion?: SelectVersionEnum;
    panelTypes?: PanelTypeEnum[];
    visibilityCodes?: VisibilityCodesEnum;
    enableExternalUser?: boolean;
}
/**
 * pc端选人组件，该接口需要鉴权 返回结果定义
 * @apiName taurus.common.chooseContact
 */
export interface ITaurusCommonChooseContactResult {
    name: string;
    avatar: string;
    emplId: string;
}
/**
 * pc端选人组件，该接口需要鉴权
 * @apiName taurus.common.chooseContact
 * @supportVersion ios: 1.1.0 android: 1.1.0
 */
export declare function chooseContact$(params: ITaurusCommonChooseContactParams): Promise<ITaurusCommonChooseContactResult[]>;
export default chooseContact$;
