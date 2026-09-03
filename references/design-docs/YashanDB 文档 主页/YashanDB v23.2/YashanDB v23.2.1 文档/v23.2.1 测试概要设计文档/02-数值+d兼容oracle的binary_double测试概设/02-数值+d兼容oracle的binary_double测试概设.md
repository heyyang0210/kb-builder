Created by 贺天欢, last modified on 十二月 13, 2023

#   [YDBRD-XXXX : XXX Design（XXX测试方案设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#ydbrd-xxxx--xxx-designxxx%E6%B5%8B%E8%AF%95%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

IR链接：    [YDBRD-23244](https://jira.yasdb.com/browse/YDBRD-23244?src=confmacro)    -  执行SQL语句设置binary_double列的值后会加个d，如set col1=12.123d  验收中

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

数值类型后附字母d，表示将数据类型设置为binary_double 主要用于数值类型兼容；

数值类型后带字母d的时候，表示数据类型应设置为binary_double    
  在多种应用场景（如filter、column），都统一表示数值类型为binary_double

支持行存+列存（即单机、分布式、集群都支持）

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

1、不涉及配置参数、视图、函数的改动

*2、*  *数值表示兼容oracle的数值后加d/D，表示double（即binary_double）数据类型的数值，且继承原有double类型和其他数据类型的显示和隐式转换*

*3、*  *行存/列存表都支持，单机/分布式/集群也都支持*

*4、执行SQL语句*  *insert和update。。set时候都支持设置数值后带d*  */D，*  *其他的select和create列带默认值、create列类型内的数值，函数入参，作为filter条件等都支持这种表示（具体约束见下面）*

*5、导入导出也支持这种表示*

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

1. Oracle将'd'/'D'后的部分作为别名处理，Yasdb目前作拦截报错
1. Oracle中带d数值位于orderby不起作用，Yasdb仍作为binary_double处理
1. Oracle的create table列中带d报错，Yasdb正常create
1. 本次只做binary_double的数值表示兼容，binary_float的暂不支持（即数值+f(F)这种）


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*数值类型表示兼容，执行SQL语句设置binary_float列的值后会加个d，如update table set col1=0d，col1是*  *binary_float列。*

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

1、根际开发实现原理只是涉及前端解析，其他比如表操作、函数、plsql、高级包或者导数等都未涉及改动，因此对于各处涉及到double数据类型相关的只做简单覆盖，不做深入复杂场景测试；

2、  列表复用行表用例，在行表基础上调整用例后测试（覆盖单机、分布式、集群环境）

3、  重点还是在于：更新double类型列值时set的数据以’数值+D/d‘表示时，能够解析成功并插入的这种DML的数据类型场景

4、导入导出部分经确认后不涉及（exp导出的元数据没有带d的，imp导入的是exp导出的就也不涉及；yasldr导入必须加单引号但这个SR不支持识别单引号内数值+d，经确认oracle也是不支持这样导入）

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*不涉及*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*guider框架+jdbc模式覆盖DB部分*

*列表复用行表用例并调整测试*

*环境覆盖单机、分布式、集群*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*