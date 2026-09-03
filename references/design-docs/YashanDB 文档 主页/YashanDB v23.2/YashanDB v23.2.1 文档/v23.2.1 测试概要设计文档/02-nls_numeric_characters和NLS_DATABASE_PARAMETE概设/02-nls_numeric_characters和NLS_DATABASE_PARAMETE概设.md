Created by 贺天欢, last modified by  孟麟 on 三月 28, 2024

#   [YDBRD-XXXX : XXX Design（XXX测试方案设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#ydbrd-xxxx--xxx-designxxx%E6%B5%8B%E8%AF%95%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

IR链接：    [YDBRD-21444](https://jira.yasdb.com/browse/YDBRD-21444?src=confmacro)    -  支持 nls_numeric_characters功能和NLS_DATABASE_PARAMETERS视图  验收中  ，    [YDBRD-21261](https://jira.yasdb.com/browse/YDBRD-21261?src=confmacro)    -  支持 nls_numeric_characters功能和NLS_DATABASE_PARAMETERS视图  完成

SR链接：

YDBRD-22118  支持 nls_numeric_characters功能

YDBRD-22119 支持NLS_DATABASE_PARAMETERS视图

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

*部署形态为 *  *单机（行）*

*支持 nls_numeric_characters功能：*

*1）nls_numeric_characters只做'. '和'.,'，即小数点保持为'.'，千分位为' '和',' 两种情况*

*eg：alter session/system set nls_numeric_characters='. '（里面是点号和空格）*    
  *2）按配置情况，number合法字符串确保to_char和to_number支持*

*3) 支持NLS_DATABASE_PARAMETERS视图、支持*  *NLS_*  *SESSION*  *_PARAMETERS*  *视图（兼容升级场景）*

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

1、to_char/to_number的nlsparam参数暂时不做（oracle支持nlsparam参数），只通过alter session/system来设置配置参数

2、本次小数点分隔符不能修改，只做千分位更改，只能为' '和','两种情况（oracle小数点分隔符和千分位更改为其他字符，且设置超过2个分隔符时不报错，从第3个字符起不受符号限制，因实际不起作用，最大输入字符串长度255）

3、当使用'.'和','格式符时，即使用默认的字符；

     当使用'D'和'G'格式符时，即使用设置的字符（若没设置则为默认字符）

4、NLS_DATABASE_PARAMETERS视图只有NLS_NUMERIC_CHARACTERS、NLS_NCHAR_CHARACTERSET、NLS_CHARACTERSET三个参数（oracle20个）

5、NLS_SESSION_PARAMETERS视图只有NLS_NUMERIC_CHARACTERS一个参数（oracle17个）

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

####   [3.1.1 nls_numeric_characters功能](https://conf.yasdb.com/pages/viewpage.action?pageId=133573282#521-nls-database-parameters%E8%A7%86%E5%9B%BE)  

1. 设置的时候只能包含两个字符（字节），第一个字符（字节）表示小数点分隔符，第二个字符（字节）表示千分位分隔符
1. 两个字符（字节）不能相同，且不能包括'>', '<', '+', '-', 数值
1. 目前小数点分隔符只支持'.'，千分位只能为' '和','两种情况，即只有'. '和'.,'两种情况
1. 系统级别NLS_DATABASE_PARAMETERS时，设置命令alter system set中，scope只支持spfile（写入配置文件，重启生效）
1. 会话级别影响NLS_SESSION_PARAMETERS时，立即生效，alter     session     set   nls_numeric_characters =   '.,'  ;
1. to_number千分位符有以下约束：


> to_number的G对应千分位，D对应小数点，当有fmt时，严格根据设置项匹配；当D出现在最后时，匹配的字符串可以缺省；G在最后不能缺省  to_number的fmt当没有出现G跟D时，小数点对应的分隔符只能在第一个字符串的最后出现一次，且不能出现在千分位分隔符之前；而千分位分隔符可以出现多次，但只有to_char的合法输出才能作为to_number的输入

|语句|是否正确执行|结果|
|:---|:---|:---|
|to_number('123', '999D')|成功|123|
|to_number('123', '999G')|失败，'123'不是to_char的合法输出，应该是'123,'|  
|


|语句|是否正确执行|结果|
|:---|:---|:---|
|to_number('123.', '999')|成功|123|
|to_number('1.2,3', '9D9G9')|失败，G只能在D前面|  
|
|to_number('123', '9,,,,,,,999')|成功|123|
|to_number('12,3', '99,99')|失败，'12,3'不是to_char的合法输出（和指定格式不符），应该是'1,23'|  
|
|to_number('1,23', '999')|失败，'1,23'不是to_char的合法输出（和指定格式不符），应该是'123'|  
|


####   [3.2.1 NLS_DATABASE_PARAMETERS视图](https://conf.yasdb.com/pages/viewpage.action?pageId=133573282#521-nls-database-parameters%E8%A7%86%E5%9B%BE)  

1.视图字段：

|字段|类型|描述|
|:---|:---|:---|
|parameter|varchar2(128)|参数名|
|value|varchar2(64)|参数值|


参数总共有3项（oracle有20项）

|参数项|
|:---|
|NLS_NUMERIC_CHARACTERS|
|NLS_NCHAR_CHARACTERSET|
|NLS_CHARACTERSET|


  [3.2.1 NLS_SESSION_PARAMETERS视图](https://conf.yasdb.com/pages/viewpage.action?pageId=133573282#521-nls-session-parameters%E8%A7%86%E5%9B%BE)  

1.视图字段：

|字段|类型|描述|
|:---|:---|:---|
|parameter|varchar2(30)|参数名|
|value|varchar2(64)|参数值|


参数总共有1项（oracle有17项）

|参数项|
|:---|
|NLS_NUMERIC_CHARACTERS|


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*需求本身的主要应用场景：1、*  *通过alter session/system来设置配置参数，只有'. '和'.,'两种情况2、查看*  *NLS_DATABASE_PARAMETERS、NLS_*  *SESSION*  *_PARAMETERS视图参数正确*

*需求与其他特性的关联场景：*  *按配置情况，number合法字符串确保to_char和to_number支持*

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*1.*  主要采用的等价类法，边界值  ，场景法组合进行设计

列出所有的参数种类，划分有效等价类和无效等价类，该方法中会穿插使用边界值法。无效等价类单独进行测试

*2.*  *分布式、集群、列表不支持，需要考虑补充拦截用例*

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

参数配置并发测试；

视图查询并发测试；

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略：按用例级别优先级测试*

*测试框架满足度：guider全覆盖*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*

与oracle实现差异：

1. NLS_NUMERIC_CHARACTERS参数值相比oracle多了单引号，查视图结果：'.,'或者'. '  ---开发已解决，现在和oracle已对齐，不会多带单引号

2. TO_NUMBER格式符0与oracle、列存做了对齐，原本to_number('.12', '0.99')正常输出，但是现在报错

3. TO_NUMBER千分位符与列存进行了对齐，与oracle存在差异，即to_number('1,2,34', '9,999')在oracle不报错，但是在anchorbase和crab都报错

4.  Oracle中'G'和'.'不能共存，','和'D'不能共存，之前实现的千分位没有考虑到，本次继续沿用以前的，不对齐oracle更改

5.NLS_NUMERIC_CHARACTERS我们是直接匹配，参数要么是'.,'要么是'. '，都不是就报错

6.NLS_DATABASE_PARAMETERS和NLS_SESSION_PARAMETERS视图的参数比oracle少很多

后续关注：

1.format数据类型是nchar\nvarchar时候是否正常

2.只有sys有权限更改nls_numeric_characters参数，其他用户没权限