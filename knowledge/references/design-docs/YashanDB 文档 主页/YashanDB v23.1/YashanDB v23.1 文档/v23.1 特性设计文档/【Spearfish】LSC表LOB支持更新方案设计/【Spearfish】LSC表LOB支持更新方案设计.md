Created by 陈晓晴, last modified on 十月 16, 2023

SR链接：    [[YDBRD-12910] 单机列表支持LOB更新删除 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-12910)  

#   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#1-overview概述)  

目前列存LOB不支持更新操作，使用场景受限，因此需要支持列存lob的更新操作。

  


#   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#2-features功能特性)  

  完善LSC表LOB功能。     

#   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=64834348#3-interfaces%E6%8E%A5%E5%8F%A3)  

无新增对外接口。

#   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#4-limitations功能限制)  

更新限制同tac、lsc的更新限制。

#   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#5-detail-design详细设计)  

##   [更新](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#5-detail-design详细设计)  

### 执行模块：

1. 分区的情况，涉及lob插入的地方，都需要检查lob值对应的cursor是否赋值了partNum。


### 存储模块：

在调用对应存储模块的更新接口（swfUpdate、spfUpdate）后，需要执行原outLine lob的删除检查。

### ** **  **SWF VDS 更新：**

lob类型在swf里使用vds存储，目前vds的类型如下：

```
typedef enum EnVdsLinkType {
    VDS_LINK_TYPE_UNKNOWN = 0,
    VDS_LINK_TYPE_NULL,
    VDS_LINK_TYPE_INLINE,
    VDS_LINK_TYPE_HEAP_ROW,
    VDS_LINK_TYPE_LOB,       // lob coupon store in link.
    VDS_LINK_TYPE_HEAP_LOB,  // lob coupon store in heap.
    VDS_LINK_TYPE_KNL_LOB,   // outrow knl_coupon store in heap.
} VdsLinkType;

```

  


对于LOB类型来说，更新的情况下存储在vds内的link类型可能会发生改变。

### 方案一：与实际LINK类型相符的更新。（采用）

即更新对应的存储类型，在vds内部存储的字符串长度由短变长则在原基础上申请新的heap row进行插入，原行（若存在）则进行更新；

字符串长度由长变短则删除多余的heap row，需要保留的heap row则进行更新。同时存在需要刷新cbu中存储的link。规则如下：

|原link\更新后|null|inline|heap row(1 heap row)|lob(2-3 heap row)|heap lob（5 heap row）|knl lob(1 heap row)|  
|
|---|---|---|---|---|---|---|---|
|null   (HINT)|无需操作|刷link|插入+刷link|插入+l刷ink|插入+刷link|插入+刷link|可逻辑复制|
|inline   (HINT)|刷link|刷link|插入+刷link|插入+刷link|插入+刷link|插入+刷link|可逻辑复制|
|heap row|删除+刷link|删除+刷link|**更新1行，删除0行 **|插入新行，更新原row+刷link|插入三行，更新原row+刷link|**更新1行，删除0行 + 刷link**|  
|
|lob|删除+刷link|删除+刷link|**更新1行，删除多余行 + 刷link**|  
|插入新行，更新原row + 刷link|**更新1行，删除多余行 + 刷link**|  
|
|heap lob|删除+刷link|删除+刷link|**更新1行，删除多余行 + 刷link**|**更新**  **2/3行**  **，删除多余行 + 刷link**|**更新**  **4行**  **，删除0行 **|**更新1行，删除多余行 + 刷link**|  
|
|knl lob|删除+刷link|删除+刷link|**更新1行，删除0行 + 刷link**|插入新行+更新+刷link|插入新行+更新+刷link|**更新1行，删除0行 **|  
|
|  
|可逻辑复制|  
|**可逻辑复制**|  
|  
|  
|  
|


  


### 方案二：保留原LINK类型。（废弃）

与方案一类似，但字符串长度由长变短时，不删除多余的heap row，减少刷新vdslink的开销。相对的，fetch的开销则增大，以及有空闲空间的占用。

|  
|null|inline|heap row|lob|heap lob|knl lob|
|---|---|---|---|---|---|---|
|null|  
|刷link|插入+刷link|插入+刷link|插入+刷link|插入+刷link|
|inline|刷新link|  
|插入+刷link|插入+刷link|插入+刷link|插入+刷link|
|heap row|更新所有row为null|更新成inline值|  
|插入新行，更新原row+刷link|插入三行，更新原row+刷link|更新原row + 刷link|
|lob|更新所有row为null|1行更新成inline值，其余更新成null|1行更新成对应值，其余更新成null|  
|插入新行，更新原row + 刷link|更新一行row，删除其余row + 刷link|
|heap lob|更新所有row为null|指向的4行中的第1行更新成inline，其余null|指向的4行中的第1行更新成对应值，其余更新成null|指向的4行中的前三行更新成对应值，其余更新成null|  
|更新原row + 刷link|
|knl lob|删除+刷link|删除+刷link|更新+刷link|插入新行+更新+刷link|插入新行+更新+刷link|  
|


  


### **SPF 更新**

spf的更新分为热数据更新和冷数据更新。热数据的更新使用swf的更新功能，冷数据的更新是由冷数据删除+热数据插入构成，流程上无特殊适配。

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#6-testcases自测用例)  

TAC\LSC表：

1. 单表行内、外存储的LOB的更新功能
1. 分区表行内、外存储的LOB的更新功能（跨分区更新）
1. merge into 功能
1. 并发场景下的更新。


##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#7-document资料)  

1，    [https://docs.oracle.com/en/database/oracle/oracle-database/21/adlob/index.html](https://docs.oracle.com/en/database/oracle/oracle-database/21/adlob/index.html)  

2，    [LOB接口实现指定的搜索、内容更新功能](/pages/createpage.action?spaceKey=YAS&title=LOB%E6%8E%A5%E5%8F%A3%E5%AE%9E%E7%8E%B0%E6%8C%87%E5%AE%9A%E7%9A%84%E6%90%9C%E7%B4%A2%E3%80%81%E5%86%85%E5%AE%B9%E6%9B%B4%E6%96%B0%E5%8A%9F%E8%83%BD)  

3，    [LOB协议](/pages/createpage.action?spaceKey=YAS&title=LOB%E5%8D%8F%E8%AE%AE)  

4，    [Lob类型](/pages/createpage.action?spaceKey=YAS&title=Lob%E7%B1%BB%E5%9E%8B)  

  


##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

  


  


  


  


  


  


  
