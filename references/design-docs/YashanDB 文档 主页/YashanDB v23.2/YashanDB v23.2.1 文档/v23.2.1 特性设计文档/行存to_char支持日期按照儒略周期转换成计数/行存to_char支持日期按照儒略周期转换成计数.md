Created by 徐千禧, last modified on 四月 01, 2024

*详细设计-YDBRD-21640*

*IR链接：*    [YDBRD-16782](https://jira.yasdb.com/browse/YDBRD-16782?src=confmacro)    *-*  *to_date和to_char支持儒略日转换*  *完成*

*SR链接：*    [YDBRD-21640](https://jira.yasdb.com/browse/YDBRD-21640?src=confmacro)    *-*  *行存to_char支持日期按照儒略周期转换成计数*  *完成*

  


##   [1. 总述](#1-总述)  

本需求是市场需求，来源于华润数科。本需求的主要功能是to_char函数的支持‘JSP‘ 格式符，实现日期转换成儒略日计数整数英文全拼。

需求部署形态：单机和集群、行表。

###   [1.2 调研文档](#12-调研文档)  

  [to_char支持儒略日转换调研文档 - 徐千禧 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133588827)  

###   [1.3 需求分析](#13-需求分析)  

本需求主要在to_char函数原有基础上，增加对格式符'J' 和 ‘JSP'的适配，输出儒略日计数英文全拼，仅支持行表。

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|日期转化儒略日计数英文全拼|根据儒略日转换规则，计算对应儒略日计数后输出英文全拼|是|是|
|性能|性能场景1||否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|无||||


###   [1.5 开源依赖](#15-开源依赖)  

没有依赖的开源组件

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|----|----|否|
|SQL语法|----|----|否|
|函数|to_char(date,  'JSP' ) 返回字符全拼； to_char(date,'J') 返回日期对应儒略日计数整数|tochar函数接口codDateTextConcatElement()；儒略日转换函数接口dateToJulianDay()；|是|
|高级包|----|----|否|
|系统视图|----|----|否|
|动态视图|----|----|否|
|配置参数|----|----|否|
|驱动接口|----|----|否|
|错误码|----|----|否|
|告警|----|----|否|
|日志|----|----|否|


##   [3. 规格与约束](#3-规格与约束)  

1. 仅支持格式符 ‘ J ’后加后缀 ‘ SP ’，其余格式符暂不支持。
1. 不支持输入负数年份。注：to_date函数使用‘j'格式符返回的日期内部处理为正数。
1. 'J'格式符输出儒略日计数范围[1721424, 5373484]
1. ‘jsp’ 其中‘ j ’ 大写且‘s’大写，则输出大写全拼；‘j’大写且‘s’小写，则输出单词首字母大写；‘j’小写则输出小写全拼。
1. tochar函数输出长度规格目前分为两种情况
    1. ~~第二个参数为常量并且包含‘j’格式符时，支持输出最大长度为8000~~
    1. ~~第二个参数为常量并且不包含‘jsp’格式符时，支持输出最大长度为64~~
    1. ~~第二个参数为变量时，支持输出最大长度为78~~
1. 实际输出长度只要小于等于32000（字符表达式输出最大长度）均可成功执行。


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

该特性同时支持格式符 ‘J’ 和 'JSP'， 'J'输出儒略日计数整数， 'JSP'输出对应整数的英文全拼。

|SQL|RESULT|
|---|---|
|select to_char(to_date('2023-11-03'),'J') from dual;|2460252|
|select to_char(to_date('2023-11-03'),'JSP') from dual;|TWO MILLION FOUR HUNDRED SIXTY THOUSAND TWO HUNDRED FIFTY-TWO|
|select to_char(to_date('2023-11-03'),'jsp') from dual;|two million four hundred sixty thousand two hundred fifty-two|


###   [4.2 特性功能点1](#42-特性功能点1)  

根据第一个参数的年月日计算对应儒略日计数整数值，计算方法如下：

设Y为给定年份，M为月份，D为该月日期（可以带小数）。

（1）若M > 2，Y和M不变；若 M =1或2，以Y–1代Y，以M+12代M，换句话说，如果日期在1月或2月，则被看作是在前一年的13月或14月。

（2）对格里高利历有：A = INT（Y/100）， B = 2 - A + INT(A/4)；对儒略历，取 B = 0。

（3）要求的儒略日即为：JD = INT( 365.25*(Y+4716) ) + INT( 30.6001*(M+1) ) + D + B - 1524.5

注意：（1）公式中的INT( )是取整的意思，由于不同的计算机语言对负数取整所采用的操作不同，所以本公式使用了一些技巧，避免出现负数，INT( )只对正数取整；（2）本公式适用于计算-4712年1月1日12时以后的任何日期的儒略日，不使用于此之前的日期。

###   [4.3 特性性能点2](#43-特性性能点2)  

根据计算出来的儒略日计数整数值，转化成英文全拼流程如下：

构造四个英文拼写数组，分别为：

gOneThroughNine[ ] =  {one, two ... nine}

gTenThroughNineteen[ ] =  {ten, eleven .. nineteen}

gTens [ ] = {twenty, thirty, ... ninety}

gThous [ ] = {thousand, million}

将整数分为三个，分别为{个，十，百} 、{千，万，十万}、{百万}， 每组都看成3位以内的整数number，第一到第三组号group分为别{1,2,3}；

当number < 10 ， 输出gOneThroughNine[ ]， 后跟 gThous [group];

当number < 20 ， 输出gTenThroughNineteen[ ]，后跟 gThous [group];

当number < 100 ， 根据number/10 和 number%10的结果输出gTens[ ]和gOneThroughNine[]对应值，后跟 gThous [group];

均不是以上情况时，number/100跟gThous [group]，number%100的结果递归调用该函数。

特殊处理： 在输出gTens[]数组元素时，需要额外判断当前number个位是否为0，不为0则需要输出 ‘ - ’。

###   [4.4 特性性能点3](#44-特性性能点3)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. to_char第一个参数所能支持的所有类型。
1. sp后缀前面跟（1）分隔符（2）格式符（3）双引号引起的字符。
1. 儒略日计数整数2299160对应日期1582-10-04，2299161对应日期1582-10-15


|SQL|RESULT|
|---|---|
|alter session set nls_date_format  = 'yyyy-mm-dd';||
|select to_char(to_date('2021-3-4','yyyy-mm-dd'), 'jsp') from dual;|two million four hundred fifty-nine thousand two hundred seventy-eight|
|select to_char(to_date('2021-3-4','yyyy-mm-dd'), 'yy-jsp') from dual;|21-two million four hundred fifty-nine thousand two hundred seventy-eight|
|select to_char(to_date('2021-3-4','yyyy-mm-dd'), 'yy jsp') from dual;|21 two million four hundred fifty-nine thousand two hundred seventy-eight|
|select to_char(to_date('2021-3-4','yyyy-mm-dd'), 'yy"年"jsp') from dual;|21年two million four hundred fifty-nine thousand two hundred seventy-eight|
|select to_char(to_date('2021-3-4','yyyy-mm-dd'), 'j-sp') from dual;|格式无法识别|
|select to_char(to_date('2021-3-4','yyyy-mm-dd'), 'j    sp') from dual;|格式无法识别|
|select to_char(to_date('2021-3-4','yyyy-mm-dd'), 'j"中文"sp') from dual;|格式无法识别|
|select to_char(to_date('2021-3-4','yyyy-mm-dd'), 'jspsp') from dual;|格式无法识别|


sp前必须紧跟格式符j， 不允许存在分隔符或双引号； 不支持spsp形式。

##   [6.资料设计章节](#6资料设计章节)  

完善文档：/开发手册/SQL参考手册/内置函数/TO_CHAR

##   [7.未来规划](#7未来规划)  