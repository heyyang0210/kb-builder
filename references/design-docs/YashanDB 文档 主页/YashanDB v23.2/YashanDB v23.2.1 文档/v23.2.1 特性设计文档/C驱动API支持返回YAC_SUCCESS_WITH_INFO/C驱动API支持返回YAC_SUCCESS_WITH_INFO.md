Created by 侯忠林, last modified on 十二月 25, 2023

  


##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

目前C驱动的API接口只支持  **YAC_SUCCESS/YAC_ERROR**  两种返回值，对于服务端返回的  **YAC_SUCCESS_WITH_INFO**  直接当成  **YAC_SUCCESS**  处理了，所以导致YAC_SUCCESS_WITH_INFO的返回值类型，并不能返回到外层API里面，API也不能返回YAC_SUCCESS_WITH_INFO的返回值了。外场超图直接使用的是C驱动，也有需要支持返回值  **YAC_SUCCESS_WITH_INFO**  的需要。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持功能：

对于C驱动需要支持YAC_SUCCESS_WITH_INFO返回值的API接口，支持返回YAC_SUCCESS_WITH_INFO的返回值。

  


##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

|接口|类型|说明|
|---|---|---|
|yacFetch|修改|新增YAC_SUCCESS_WITH_INFO的返回值|
|yacSetStmtAttr|修改|新增YAC_ATTR_ROWS_STATUS  的参数类型，用于在绑定参数时获取每一行的行状态。|
|yacSetEnvAttr|修改|新增属性YAC_ATTR_RETURN_SUCCESS_WITH_INFO，值YAC_TRUE,YAC_FALSE,数据类型YacBool|
|yacGetEnvAttr|修改|新增属性YAC_ATTR_RETURN_SUCCESS_WITH_INFO获取属性值，数据类型YacBool|


  


##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

无。

  


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

|修改点|类型|现状|修改方案|
|---|---|---|---|
|yacRequest|接口|C驱动请求服务端的接口中，目前接种在接收到服务端返回的YAC_SUCCESS_WITH_INFO返回值都是直接返回YAC_SUCCESS，并切此接口也不支持返回YAC_SUCCESS_WITH_INFO。|接受到服务端返回YAC_SUCCESS_WITH_INFO的返回值的时候进行特殊处理，解析错误信息，以及返回YAC_SUCCESS的部分数据。如果涉及到MORE_DATA的数据后续数据也要进行特殊处理。|
|YAC_CALL|宏|目前这个宏是C驱动内部调用内部接口的宏，只判断不等于YAC_SUCCESS则直接返回YAC_ERROR。|对于不接受YAC_SUCCESS_WITH_INFO返回值的接口，无需改造，如果需要支持YAC_SUCCESS_WITH_INFO返回值的则需要使用新的YAC_CALL_WITH_INFO。|
|YAC_EXPECT_CALL|宏|测试用例中目前不支持返回YAC_SUCCESS_WITH_INFO的宏|增加YAC_EXPECT_CALL_WITH_INFO的宏支持返回YAC_SUCCESS_WITH_INFO的返回值。|
|yacFetch|接口|接口目前不支持YAC_SUCCESS_WITH_INFO，只支持YAC_SUCCESS/YAC_ERROR。|yacFetch在绑定varchar或者其他有可能出现截断的数据类型时，如果数据出现截断则返回YAC_SUCCESS_WITH_INFO，例如绑定varchar但是数据类型时lob，出现数据截断了，则返回YAC_SUCCESS_WITH_INFO并带有错误信息。在批量执行时，如果全成功则接口返回YAC_SUCCESS，如果一行失败则直接返回YAC_ERROR，如果其中一行返回YAC_SUCCESS_WITH_INFO，则继续decode行，最终解析完所有行后接口返回YAC_SUCCESS_WITH_INFO。|
|yacSetStmtAttr|接口|不支持设置YAC_ATTR_ROWS_STATUS  ，获取批量绑定时的每一行的状态信息|支持设置YAC_ATTR_ROWS_STATUS  ，用于在批量绑定的时候，返回每一行的状态信息，用于确定每一行的状态。可以传入一个数组指针值，该值指向调用yacFetch后包含行状态值的数组。 数组的元素数与行集中的行数相同。此语句属性可以设置为 null 指针，在这种情况下，驱动程序不返回行状态值。 可以随时设置此属性，但直到下此调用   yacFetch  时才会使用新值。YacRowStatus值范围：YAC_ROW_SUCCESS，YAC_ROW_SUCCESS_WITH_INFO，YAC_ROW_ERROR。    
|
|yacSetEnvAttr|接口|不支持设置YAC_ATTR_RETURN_SUCCESS_WITH_INFO|新增属性YAC_ATTR_RETURN_SUCCESS_WITH_INFO，值YAC_TRUE,YAC_FALSE,数据类型YacBool。|
|yacGetEnvAttr|接口|不支持设置YAC_ATTR_RETURN_SUCCESS_WITH_INFO|新增属性YAC_ATTR_RETURN_SUCCESS_WITH_INFO获取属性值,数据类型YacBool。|


**存在数据截断的情况**  ：

Clob2String    
  NClob2String    
  Blob2String    
  Blob2Binary

Json2String

**新增加env属性用于控制功能开关**

YAC_ATTR_RETURN_SUCCESS_WITH_INFO

属性支持yacSetEnvAttr,yacGetEnvAttr,数据类型YacBool。暂时不支持配置文件yasc_env.ini配置。

**新增枚举**  ：

typedef enum EnYacRowStatus {    
  YAC_ROW_SUCCESS = 0,    
  YAC_ROW_SUCCESS_WITH_INFO = 1,    
  YAC_ROW_ERROR = -1,    
  } YacRowStatus;

  


##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1.yacFetch能够返回YAC_SUCCESS_WITH_INFO，并且错误信息正常获取，结果正常获取。

2. yacFetch能返回YAC_SUCCESS，并且无法获取错误信息，结果正常获取。

3.yacFetch能够返回YAC_ERROR，能够或者错误信息，结果无法获取。

4.yacSetStmtAttr能够设置  SQL_ATTR_ROW_STATUS_PTR参数，并且在fetch后或者行状态信息。

（全成功，全失败，部分成功，少行数）

5.在clob2String字符串被截断时fetch返回YAC_SUCCESS_WITH_INFO。

6.在blob2String字符串被截断时fetch返回YAC_SUCCESS_WITH_INFO。

7.在blob2  Binary时  被截断fetch返回YAC_SUCCESS_WITH_INFO。

8.在nclob2String字符串被截断时fetch返回YAC_SUCCESS_WITH_INFO。

9.yacSetEnvAttr支持配置YAC_ATTR_RETURN_SUCCESS_WITH_INFO，并且能够控制功能开关,并且支持类型值校验。

10.yacGetEnvAttr支持获取YAC_ATTR_RETURN_SUCCESS_WITH_INFO.

  


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

  


*评估代码量KLOC、工作量（人天）。*

*业务代码100行左右，工作量4人天。*

  


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

无。