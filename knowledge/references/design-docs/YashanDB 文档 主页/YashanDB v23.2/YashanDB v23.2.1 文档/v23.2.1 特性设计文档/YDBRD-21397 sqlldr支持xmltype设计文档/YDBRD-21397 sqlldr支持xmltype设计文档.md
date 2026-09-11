Created by 贺国锋, last modified by  周湘淞 on 十月 18, 2024

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

需求：    [YDBRD-21397](https://jira.yasdb.com/browse/YDBRD-21397?src=confmacro)    -  sqlldr支持xmltype  完成

yasldr增加对XMLTYPE类型字段的输入导入的支持。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持对xmltype类型的字段的输入导入

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

本特性仅新增对xmltype类型的字段的导入支持，不涉及新增接口

  


  [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

目前服务端支持的xmltype仅限于把xml内容当成string/clob去存储，并不涉及xml的解析和格式校验等等，yasldr导入时也是将xmltype作为字符串形式发送给服务端，服务端去做类型转换和存储，客户端不涉及类型转换。

鉴于以上原因，在xmltype字段中的有效数据包含双引号时，其有效数据中的双引号需要进行转义。

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

由于服务端将xmltype作为CLOB类型存储，因此需要考虑lobfile导入和lls导入。

此外，需要考虑字段类型的长度限制。

*边界值：需要考虑xmltype超过32000字段大小限制的情况。*

*因此，不涉及新接口和函数功能的开发，需要适配当前函数的限制，具体为：*

*1、ldrCheckLobCache()：该函数需要新增适配xmltype类型的判断*

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

准备环境：创建包含xmltype字段的数据表

自测用例1：有效数据不包含双引号，执行导入，查看导入结果

自测用例2：有效数据包含双引号，但未转义，执行导入，查看导入结果

自测用例3：有效数据包含双引号，且已转义，执行导入，查看导入结果

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

  


*评估代码量KLOC、工作量（人天）。*

  


  


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

不涉及。

## Comments:

|  [](null)  ,在xml字符串长度超过32K大小限制时，报错为exceeding string limit，这一点和oracle保持一致，后续根据市场反应再考虑是否优化报错提示。,Posted by heguofeng at 十月 17, 2023 15:03|
|---|
