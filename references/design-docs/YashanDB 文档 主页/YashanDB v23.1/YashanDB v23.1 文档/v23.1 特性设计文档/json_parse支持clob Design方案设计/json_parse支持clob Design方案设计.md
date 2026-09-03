Created by 马士杰 on 一月 18, 2024

  


#   [YDBRD-13169 : json_parse支持clob Design方案设计](#ydbrd-13169--json-parse支持clob-design方案设计)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-13169](https://jira.yasdb.com/browse/YDBRD-13169)  

##   [1. Overview（概述）](#1-overview概述)  

本功能主要目的是json支持大内存，json_parse 将大json拷贝到连续大内存然后解析，解析出来的json也用连续内存存储。其他的json函数，JsonArrayGet/JsonArrayLength/JsonExists/JsonQuery/JsonSerialize首次访问大内存时，也将json数据读到连续内存，然后再参与运算。部署形态为单机行存。

##   [2. Features（功能特性）](#2-features功能特性)  

1.新增大内存的分配接口，统一使用新增的大内存管理json解析过程中使用的空间2.将部分相关的函数接口换位新增的yason函数接口，保证功能不受影响

##   [3. Interfaces（接口）](#3-interfaces接口)  

本需求主要新增大内存分配接口，包括内存pool的建立和管理，mexContext的建立和管理，内存分配器MexMctxAlloc的建立和管理。新增接口包括：

CodResult mexPoolCreate(MexPool* pool, CodUint64 size, CodUint32 blockSize, const CodChar* name);

CodResult mexPoolAttach(MexPool* pool, CodChar* buf, CodUint64 size, CodUint32 blockSize, const CodChar* name);

CodVoid   mexPoolDestroy(MexPool* pool);

CodResult mexContextCreate(MexPool* pool, MexContext** context);

CodVoid   mexContextDestroy(MexContext* context);

CodResult mexAlloc(MexContext* context, CodUint32 size, CodChar** buf);

CodVoid   mexFree(MexContext* context, CodChar* buf);

CodMemAlloc codMemGetMexAlloc();

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

之前的json的大小上限为64kb，解析过程中产生的二进制流的大小上限为260kb，现在将规格变为json的大小上限为32mb，二进制流的大小也为32mb，超过则报错。可分配的大内存大小默认为为1024mb。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

在infra中新增ani_memor_ex.c/.h，新增大内存的分配与管理。使用infra中新增的yason函数，替换部分bif_json中的json函数。在anlInstance上新增    
  MexPool           mexPool;随anlCreateSQLPool 初始化大内存，随releaseExecSource释放

在stmt上新增MexContext*       mexContext;

这两个结构，用来维护大内存的内存池在所有的execJson函数中使用stmt上已有的mexContext，在需要解析的场景中开辟parseContext进行解析，解析后释放。大内存的释放在语句执行结束后的anlReleaseExecResource中释放。

在bif_json中，将从stmt中分配的内存改为从mexContext中分配。

将部分json函数的接口换为yason接口，使用yasonParse函数解析文本，解析结果为Yason类型，json函数的返回值为Lob类型，再进行一次转换将Yason类型转为lob类型。其他json函数如果需要使用yason类型，则将lob类型转为yason类型后参与运算。

###   [5.1 Compatibility（兼容性）](#51-compatibility兼容性)  

与之前的json和json函数保证兼容，同时保证对大json的支持。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

1.路径表达式相关的接口暂未替换，因为infra还未实现，待实现后再替换。