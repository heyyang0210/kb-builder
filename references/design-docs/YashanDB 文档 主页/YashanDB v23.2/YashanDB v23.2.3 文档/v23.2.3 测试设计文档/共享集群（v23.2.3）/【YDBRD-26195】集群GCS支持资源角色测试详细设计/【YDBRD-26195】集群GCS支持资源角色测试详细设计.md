Created by 马爽, last modified on 五月 29, 2024

**IR链接：**

  [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b001](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b001)    **?**    
  **#YASHAN-177 集群多实例并发刷盘优化**

**SR链接：**

  [https://pingcode.yasdb.com/pjm/items/6618f16dfd997db58ad84cd1](https://pingcode.yasdb.com/pjm/items/6618f16dfd997db58ad84cd1)    **?**    
  **#YDBRD-26195 集群GCS支持资源角色**

**开发概要设计文档：**    [多实例刷盘概要设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150632568)  

**开发详细设计文档：**    [资源角色详细设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=152998702)  

**测试概要设计文档：**    [YDBRD-29085 测试概要设计](147770455.html)  

# 1. 概述

在原有资源模式（Null、Share、Exclusive）的基础上，引入资源角色：本地角色（Local）和全局角色（Global），模式和角色互相交互成不同的状态  ，在某些场景下能够减少跨实例通信，提升页面传输效率。

# 2. 需求分析

## 2.1 功能点分析

#### 2.1.1 GCS资源角色定义

**本地角色(Local)：**

- 页面第一次从磁盘加载到内存（可以是S模式也可以是X模式）；
- 页面只在本地修改过，并且没有其他实例访问（只能是X模式）；
- 多个实例上同时存在，且都是干净页面（只能是S模式）。


**全局角色(Global）：**

- 有一个实例修改过后，后续有其他实例访问或者修改；
- 有多个实例修改过页面的版本（Global都是脏页）。


在正常场景下，全局视角里，一个页面资源要么是Local，要么是Global，二者是互斥的，少数场景会出现共存的情况

#### **2.1.2 术语解释**

|  
|术语|缩写|含义|
|:---|:---|:---|:---|
|1|Null|N|持有无效模式的资源，如缓冲区内被失效的block。|
|2|Share|S|持有共享模式的资源，如通过查询获取到的Current Block。|
|3|Exclusive|X|持有排他模式的资源，如通过修改获取到的Current Block。|
|4|CkptMarked|C|当前脏页正在被DBWR写盘，已经拷贝到DBWR Buffer，实例内资源状态。|
|5|Dirty|D|当前是个脏页，实例内资源状态。|
|6|HasPastcopy|H|Xowner上的状态，表明当前其他实例上持有Pastcopy。|
|7|Pastcopy|P|当前实例持有的是Pastcopy页面。|
|8|Local|L|没有实例修改过，或只有本实例修改并且只有本实例持有最新版本。|
|9|Global|G|有多个实例修改过，或一个实例修改过后的页面被多个实例持有。|
|10|Consistent Read|CR|当前是个CR，实例内资源状态。|


#### **2.1.3 资源状态定义**

|  
|资源状态|含义|
|---|---|---|
|1|N|实例页面无效|
|2|SL|实例页面持有共享模式，页面无修改，并且其他实例不持有页面的历史版本|
|3|XL|实例页面持有排他模式，页面无修改，并且其他实例不持有页面的历史版本|
|4|XLD|实例页面持有排他模式，页面进行了修改，并且其他实例不持有页面的历史版本|
|5|SGD|实例页面持有共享模式，并且其他实例持有页面的历史版本|
|6|SGP|实例页面持有共享模式，并且本地是历史PC页面版本|
|7|XGD|实例页面持有排他模式，并且其他实例持有页面的历史版本|
|8|NGP|实例页面无效，并且本地是历史PC页面版本|


#### **2.1.4 GCS层面资源状态转换**

|编号|场景,（针对实例2而言）|实例1|实例2|事件|
|---|---|:---|:---|:---|
|1|本地请求|N->SL|  
|实例1以S模式请求本地读，当前无owner|
|2||N->XL|  
|实例1以X模式请求本地写，当前无owner|
|3|跨实例请求|SL→SL|N->SL|实例2以S模式请求读，从实例1上获取页面|
|4||SL->N|N->XL|实例2  以X模式请求，不做修改，从实例1上获取页面|
|5||SL->N|N->XLD|实例2  以X模式请求并修改，从实例1上获取页面|
|6|SL锁升级|SL->N|SL->XL|实例2  以X模式请求锁升级，不做修改，实例1降级为N|
|7||SL->N|SL->XLD|实例2  以X模式请求锁升级并修改，实例1降级为N|
|8|XL锁降级|N->SL|XL->SL|实例2持有X模式，实例1以S模式请求读，实例2降级为S|
|9||N->XL|XL->N|实例2持有X模式，实例1以X模式请求，实例2降级为N|
|10|XLD锁降级|N->SGD|XLD->SGP|实例2持有脏页，实例1以S模式请求读，此时角色由Local转为Global，实例2降级为S且为PastCopy|
|11||N->XGD|XLD->NGP|实例2持有脏页，实例1以X模式请求，此时角色由Local转为Global，实例2降级为N且为PastCopy|
|12|SGD/SGP锁升级|SGP->XGD|SGD->NGP|实例1以S模式持有PastCopy，实例2以S模式持有脏页，实例1以X模式请求锁升级，实例2降级为N且为PastCopy|
|13||SGP->NGP|SGD->XGD|实例1以S模式持有PastCopy，实例2以S模式持有脏页，实例2以X模式请求锁升级，实例1降级为N且为PastCopy|
|14|XGD锁降级|NGP->SGD|XGD->SGP|实例1持有无效PastCopy，实例2以X模式持有脏页，实例1以S模式请求读，实例2降级为S且为PastCopy|
|15||NGP->XGD|XGD->NGP|实例1持有无效PastCopy，实例2以X模式持有脏页，实例1以X模式请求，实例2降级为N且为PastCopy|


相关转换图如下：    


![](https://conf.yasdb.com/download/thumbnails/150632568/roleConvert.png?version=1&modificationDate=1714318097000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU3NDgsImV4cCI6MTc4MjMxNjU0OH0.xO81W21jQ4M1N9ny7bw0QmUiKrNLVtKvJE9_nL77vhM)

#### 2.1.5 脏页刷盘中资源状态转换

只有脏页才需要刷盘变成干净页面，同样角色会由Global变成Local状态，在脏页刷盘的过程中会经历一个中间状态，过程定义如下：

|  
|初始状态|中间状态|结束状态|解释|
|:---|:---|:---|:---|:---|
|1|XLD|XLC|XL|本地脏页刷盘|
|2|SGP|SLC|SL|本地是S锁，并且本地是个PastCopy，刷盘后本地会变成有效页面，同时会触发清理PC|
|3|NGP|NC|N|本地是历史PC页面版本，刷盘后变为无效页面，反向清理|
|4|SGD|SLC|SL|本地是S锁，有其他实例持有历史版本，刷盘后本地变成有效页面，同时会触发清理PC，正向清理|
|5|XGD|XLC|XL|本地是X锁，有其他实例持有历史版本，刷盘后本地变成有效页面，同时会触发清理PC，正向清理|


相关转换图如下：

![](https://conf.yasdb.com/download/attachments/150632568/roleConvert_ckpt.png?version=1&modificationDate=1714359426000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU3NDgsImV4cCI6MTc4MjMxNjU0OH0.xO81W21jQ4M1N9ny7bw0QmUiKrNLVtKvJE9_nL77vhM)

#### 2.1.6 相关视图观测

**v$grc_resource**

|  
|字段|类型|说明|
|---|---|---|---|
|1|XOWNER|TINYINT|持有写锁或最近一次持有写锁的节点|


**v$buffer_control**

|  
|字段|类型|说明|
|---|---|---|---|
|1|TS#|INTEGER|buffer加载页面的表空间ID|
|2|FILE#|INTEGER|buffer加载页面的文件ID|
|3|BLK#|INTEGER|buffer加载页面的页面ID|
|4|DIRTY|BOOLEAN|是否是脏页  （D）|
|5|RES_STATUS,（更改为RES_MODE）|INTEGER|集群下buffer页面的资源状态    
  * 0:BP_RES_FREE  （N）    
  * 1:BP_RES_CR  （CR）    
  * 2:BP_RES_SHARED  （S）    
  * 3:BP_RES_EXCLUSIVE  （X）|
|6|PAST_COPY|INTEGER,（变更为BOOLEAN类型）|buffer control是否为past copy    
  * 0:BP_NO_PASTCOPY    
  * 1:BP_IS_PASTCOPY  （P）    
  * 2:BP_HAS_PASTCOPY  （H）|
|7|RES_ROLE,（新增）|BOOLEAN|标记是否是全局角色,*（L）,*（G）|


## 2.2 应用场景

#### 2.2.1 需求本身的主要应用场景

- 在Request-Master-Owner模型下，将资源的属性从复杂的消息交互中抽象出来，确定资源请求的状态转变机制。     只要当前状态、请求类型确定，那么请求结束之后的资源状态是确定的。
- 将全局和本地属性的资源区分开，减少跨实例通信。     部分具有LOCAL属性的页面资源，刷盘可以不产生GLOBAL事件。
- 加速故障场景下的页面恢复。     对以Share模式持有的页面，根据角色属性做出判断，是否有实例修改过，而不需要从磁盘加载通过LSN判断。


#### 2.2.2 需求与其他特性的关联场景

- gcs基础消息流场景
- 启停过程中资源状态转换
- 故障恢复过程中资源状态转换


## 2.3 规格约束

#### 2.3.1 需求定义的规格、约束，系统/模块上下文等

- 产品形态：仅涉及集群
- 节点个数：当前最大规格为4节点


#### 2.3.2 内部机制涉及的规格约束

- 不涉及


# 3. 详细测试设计

## 3.1 测试设计方法

1. 针对角色与模式的状态转换关系，需要在gcs基本消息流场景中做全量覆盖，重点分析加入角色后在页面传输、失效、刷盘场景与模式的关系，采用场景法
1. 对于实例启停和故障恢复过程中资源状态转换，重点需要关注过程中脏页刷盘后资源所处的状态
1. 对于并发测试，  统一在ddl/dml/ddl+dml的并发中去考虑，主要是针对同一页面的并发


## 3.2 详细测试设计

#### 3.2.1 gcs基础消息流场景

**涉及因子**

|  
|因子项|因子类型|说明|
|---|---|---|---|
|1|基础消息流|本地加载block|  
|
|2|  
|预读block|  
|
|3|  
|请求block读|  
|
|4|  
|请求block写|  
|
|5|  
|请求upgrade block|  
|
|6|  
|pastcopy维护|  
|
|7|  
|buffer淘汰|不涉及|
|8|RMO三者之间的关系|requester与owner在相同节点，master在单独节点|  
|
|9|  
|owner与master在相同节点，requester在单独节点|  
|
|10|  
|requester与master在相同节点，owner在单独节点|  
|
|11|  
|master、owner、requester在单独节点|  
|
|12|owner类型|Sowner|  
|
|13|  
|Xowner|  
|
|14|owner是否是脏页|是|  
|
|15|  
|否|  
|
|16|owner角色|Local|  
|
|17|  
|Global|  
|
|18|业务操作|读操作dql-select|  
|
|19|  
|写操作dml-insert/update/detele,           ddl-create/alter/drop|  
|
|20|  
|checkpoint|  
|
|21|  
|启停|  
|
|22|  
|故障|  
|


将以上因子作正交组合，可得到以下测试场景：

|  
|gcs消息流场景|RMO三者之间的关系|owner类型|owner是否有脏页|owner角色|资源状态转换|业务操作|测试步骤|预期|备注|
|---|---|---|---|---|---|---|---|---|---|---|
|1|本地加载block|无owner，requester和master在相同节点，以X模式请求页面|\|\|\|requester/master：N→XL|写操作-insert|  
|角色状态转换正常|  
|
|2|  
|无owner，requester和master在不同节点  ，以X模式请求页面|\|\|\|master：N→N,requester：N→XL|写操作-insert|  
|角色状态转换正常|  
|
|3|预读block|无owner，requester和master在相同节点，以X模式请求页面|\|\|\|requester/master：N→XL|写操作-insert|  
|角色状态转换正常|  
  和本地加载block不同的是预读可以读一批block|
|4|  
|无owner，requester和master在不同节点  ，以X模式请求页面|\|\|\|master：N→N,requester：N→XL|写操作-insert|  
|角色状态转换正常||
|5|请求block读|requester与owner在相同节点，master在单独节点|Sowner|\|Local|master：N→N,requester/Sowner：SL→SL|读操作|  
|角色状态转换正常|资源状态无变化,场景无法构造|
|6|  
|  
|  
|是|Global|master：SGP→SGP,requester/Sowner：SGD→SGD|  
|  
|角色状态转换正常|资源状态无变化|
|7|  
|  
|Xowner|\|Local|master：N→N,requester/Xowner：XL→XL|  
|  
|角色状态转换正常|资源状态无变化|
|8|  
|  
|  
|是|Local|master：N→N,requester/Xowner：XLD→XLD|  
|  
|角色状态转换正常|资源状态无变化|
|9|  
|  
|  
|是|Global|master：NGP→NGP,requester/Xowner：XGD→XGD|  
|  
|角色状态转换正常|资源状态无变化|
|10|  
|owner与master在相同节点，requester在单独节点|Sowner|\|Local|Sowner/master：SL→SL,requester：N→SL|  
|  
|角色状态转换正常|场景无法构造|
|11|  
|  
|  
|是|Global|Sowner/master：SGD→SGD,requester：SGP→SGP|  
|  
|角色状态转换正常|资源状态无变化|
|12|  
|  
|Xowner|\|Local|Xowner/master：XL→SL,requester：N→SL|  
|  
|角色状态转换正常|  
|
|13|  
|  
|  
|是|Local|Xowner/master：XLD→SGP,requester：N→SGD|  
|  
|角色状态转换正常|  
|
|14|  
|  
|  
|是|Global|Xowner/master：XGD→SGP,requester：NGP→SGD|  
|  
|角色状态转换正常|涉及到Xowner变化|
|15|  
|requester与master在相同节点，owner在单独节点|Sowner|\|Local|Sowner：SL→SL,requester/master：N→SL|  
|  
|角色状态转换正常|场景无法构造|
|16|  
|  
|  
|是|Global|Sowner：SGD→SGD,requester/master：SGP→SGP|  
|  
|角色状态转换正常|资源状态无变化,  
|
|17|  
|  
|Xowner|\|Local|Xowner：XL→SL,requester/master：N→SL|  
|  
|角色状态转换正常|  
|
|18|  
|  
|  
|是|Local|Xowner：XLD→SGP,requester/master：N→SGD|  
|  
|角色状态转换正常|  
|
|19|  
|  
|  
|是|Global|Xowner：XGD→SGP,requester/master：NGP→SGD|  
|  
|角色状态转换正常|涉及到Xowner变化|
|20|  
|master、owner、requester在单独节点|Sowner|\|Local|master：N→N,Sowner：SL→SL,requester：N→SL|  
|  
|角色状态转换正常|场景无法构造|
|21|  
|  
|  
|是|Global|master：N→N,Sowner：SGD→SGD,requester：SGP→SGP|  
|  
|角色状态转换正常|资源状态无变化|
|22|  
|  
|Xowner|\|Local|master：N→N,Xowner：XL→SL,requester：N→SL|  
|  
|角色状态转换正常|  
|
|23|  
|  
|  
|是|Local|master：N→N,Xowner：XLD→SGP,requester：N→SGD|  
|  
|角色状态转换正常|  
|
|24|  
|  
|  
|是|Global|master：N→N,Xowner：XGD→SGP,requester：NGP→SGD|  
|  
|角色状态转换正常|涉及到Xowner变化|
|25|请求block写|requester与owner在相同节点，master在单独节点|Sowner|\|Local|master：N→N,requester/Sowner：SL→XLD|写操作|  
|角色状态转换正常|场景无法构造|
|26|  
|  
|  
|是|Global|master：SGP→NGP,requester/Sowner：SGD→XGD|  
|  
|角色状态转换正常|  
|
|27|  
|  
|Xowner|\|Local|master：N→N,requester/Xowner：XL→XL|  
|  
|角色状态转换正常|资源角色无变化|
|28|  
|  
|  
|是|Local|master：N→N,requester/Xowner：XLD→XLD|  
|  
|角色状态转换正常|资源角色无变化|
|29|  
|  
|  
|是|Global|master：NGP→NGP,requester/Xowner：XGD→XGD|  
|  
|角色状态转换正常|资源角色无变化|
|30|  
|owner与master在相同节点，requester在单独节点|Sowner|\|Local|Sowner/master：SL→N,requester：N→XLD|  
|  
|角色状态转换正常|场景无法构造|
|31|  
|  
|  
|是|Global|Sowner/master：SGD→NGP,requester：SGP→XGD|  
|  
|角色状态转换正常|  
|
|32|  
|  
|Xowner|\|Local|Xowner/master：XL→N,requester：N→XLD|  
|  
|角色状态转换正常|  
|
|33|  
|  
|  
|是|Local|Xowner/master：XLD→NGP,requester：N→XGD|  
|  
|角色状态转换正常|  
|
|34|  
|  
|  
|是|Global|Xowner/master：XGD→NGP,requester：NGP→XGD|  
|  
|角色状态转换正常|  
|
|35|  
|requester与master在相同节点，owner在单独节点|Sowner|\|Local|Sowner：SL→N,requeste/master：N→XLD|  
|  
|角色状态转换正常|场景无法构造|
|36|  
|  
|  
|是|Global|Sowner：SGD→NGP,requeste/master：SGP→XGD|  
|  
|角色状态转换正常|  
|
|37|  
|  
|Xowner|\|Local|Xowner：XL→N,requeste/master：N→XLD|  
|  
|角色状态转换正常|  
|
|38|  
|  
|  
|是|Local|Xowner：XLD→NGP,requeste/master：N→XGD|  
|  
|角色状态转换正常|  
|
|39|  
|  
|  
|是|Global|Xowner：XGD→NGP,requeste/master：N→XGD|  
|  
|角色状态转换正常|  
|
|40|  
|master、owner、requester在单独节点|Sowner|\|Local|master：N→N,Sowner：SL→N,requester：N→XLD|  
|  
|角色状态转换正常|场景无法构造|
|41|  
|  
|  
|是|Global|master：N→N,Sowner：SGD→NGP,requester：SGP→XGD|  
|  
|角色状态转换正常|  
|
|42|  
|  
|Xowner|\|Local|master：N→N,Xowner：XL→N,requester：N→XLD|  
|  
|角色状态转换正常|  
|
|43|  
|  
|  
|是|Local|master：N→N,Xowner：XLD→NGP,requester：N→XGD|  
|  
|角色状态转换正常|  
|
|44|  
|  
|  
|是|Global|master：N→N,Xowner：XGD→NGP,requester：NGP→XGD|  
|  
|角色状态转换正常|  
|
|45|请求upgrade block|requester与owner在相同节点，master在单独节点|多个Sowner|\|Local|master：SL→N,requester/Sowner：SL→XLD|写操作|  
|角色状态转换正常|  
|
|46|  
|  
|  
|是|Global|master：SGP→NGP,requester/Sowner：SGD→XGD|  
|  
|角色状态转换正常|  
|
|47|  
|owner与master在相同节点，requester在单独节点|多个Sowner|\|Local|master：SL→N,requester/Sowner：SL→XLD|  
|  
|角色状态转换正常|  
|
|48|  
|  
|  
|是|Global|master：SGP→NGP,requester/Sowner：SGD→XGD|  
|  
|角色状态转换正常|  
|
|49|  
|requester与master在相同节点，owner在单独节点|多个Sowner|\|Local|master：SL→N,requester/Sowner：SL→XLD|  
|  
|角色状态转换正常|  
|
|50|  
|  
|  
|是|Global|master：SGP→NGP,requester/Sowner：SGD→XGD|  
|  
|角色状态转换正常|  
|
|51|  
|master、owner、requester在单独节点|多个Sowner|\|Local|master：SL→N,owner：SL→N,requester：SL→XLD|  
|  
|角色状态转换正常|  
|
|52|  
|  
|  
|是|Global|master：SGP→NGP,owner：SGP→NGP,requester：SGD→XGD|  
|  
|角色状态转换正常|  
|
|53|pastcopy维护|requester与owner在相同节点，master在单独节点|Sowner|是|Glocal|master：SGP→SLC→SL,requester/Sowner：SGD→SLC→SL,其他实例：NGP→NL→N|checkpoint|  
|角色状态转换正常|  
    
  观测最终状态    
    
    
|
|54|  
|  
|Xowner|是|Local|master：N→N→N,requester/Xowner：XLD→XLC→XL,其他实例：NGP→NL→N|启停|  
|角色状态转换正常||
|55|  
|  
|Xowner|是|Global|master：NGP→NL→N,requester/Xowner：XGD→XLC→XL,其他实例：NGP→NL→N|故障|  
|  
||
|56|  
|owner与master在相同节点，requester在单独节点|Sowner|是|Glocal|master/Sowner：SGP→SLC→SL,requester：SGD→SLC→SL,其他实例：NGP→NL→N|启停|  
|角色状态转换正常||
|57|  
|  
|Xowner|是|Local|master/Xowner：XLD→XLC→XL,requester：N→N→N,其他实例：NGP→NL→N|checkpoint|  
|角色状态转换正常||
|58|  
|  
|Xowner|是|Global|master/Xowner：XLD→XLC→XL,requester：NGP→NL→N,其他实例：NGP→NL→N|故障|  
|  
||
|59|  
|requester与master在相同节点，owner在单独节点|Sowner|是|Glocal|Sowner：SGP→SLC→SL,requester/master：SGD→SLC→SL,其他实例：NGP→NL→N|故障|  
|角色状态转换正常||
|60|  
|  
|Xowner|是|Local|Xowner：XLD→XLC→XL,requester/master：N→N→N,其他实例：NGP→NL→N|checkpoint|  
|角色状态转换正常||
|61|  
|  
|Xowner|是|Global|Xowner：XLD→XLC→XL,requester/master：NGP→NL→N,其他实例：NGP→NL→N|启停|  
|  
||
|62|  
|master、owner、requester在单独节点|Sowner|是|Glocal|master：SGP→SLC→SL,Sowner：SGP→SLC→SL,requester：SGD→SLC→SL,其他实例：NGP→NL→N|故障|  
|角色状态转换正常||
|63|  
|  
|Xowner|是|Local|master：N→N→N,Xowner：XLD→XLC→XL,requester：N→N→N,其他实例：NGP→NL→N|启停|  
|角色状态转换正常||
|64|  
|  
|Xowner|是|Global|master：NGP→NL→N,Xowner：XLD→XLC→XL,requester：NGP→NL→N,其他实例：NGP→NL→N|checkpoint|  
|角色状态转换正常||


对于CR Block的请求，  resMode是BP_RES_CR，资源角色取Local

#### 3.2.2 并发场景测试

测试方式：这部分主要验证引入资源角色后各个消息流在并发场景下的处理机制，并发场景下没有办法通过精确的手段来校验消息接收是否正常，只能通过数据库业务的表现是否正常来校验。对于各个消息流，主要涉及读写两类操作，在基本的ddl和dml并发中可以覆盖各种消息流。所以这部分测试，不会从单个消息流的角度去做测试，而是针对业务对象，从ddl和dml并发的角度去做覆盖。这部分会复用GCS统一测并发场景。主要考虑下面的因素

- 涉及到的对象
- 涉及到的读写操作业务
- 请求资源的实例：多个实例
- 请求资源的方式：并行执行
- 节点个数：四节点


#### 3.2.3 梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|系统级DFX分类|是否涉及|备注|
|---|---|---|
|CT|是|gcs基本场景验证|
|KT|是|并发+故障|
|长稳|是|涉及到脏页刷盘以及PastCopy维护|
|一致性|是|该需求涉及多个实例IO读盘和写盘的一致性问题|
|三方测试工具    
  (sqltest，sqlancer)|/|该需求不涉及任何sql语法层面的新增和修改，所以不涉及sql语法层面的工具|
|安全|/|该需求不涉及敏感信息和密码层面|
|DFR|/|内核层面，不需要考虑其他特性|
|HA|/|该需求和HA特性没关联，不管是HA还是非HA形态，机制都是一样的|
|压力|是|涉及到tpcc下的checkpoint|
|性能|是|不带checkpoint，十分钟|
|可维护性|是|涉及到视图变更，资料文档需要更新|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

|用例类型|测试框架|用例目录|用例个数|备注|
|:---|:---|:---|:---|:---|
|基础场景|ha|ha/ha_cluster/testcase/common/global_memory/basic_scene/|90|复用用例70个，新增用例20个|


# 6. 测试环境说明

集群相关环境

# 7. 工作量评估

工作量：14  *人天*

计划测试完成时间：2024/5/17

# 8. 上车工程分析

第一次上车工程分析：    [Agile_master_L2_Build #4683 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/4683/)  

|编号|工程名称|工程链接|失败用例|备注|
|---|---|---|---|---|
|集群|  
|  
|  
|  
|
|  
|  [Agile_L3_cluster_DBCommon_arm_2_copy](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/copy_ms/job/Agile_L3_cluster_DBCommon_arm_2_copy/)  |  [Agile_L3_cluster_DBCommon_arm_2_copy #1 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/copy_ms/job/Agile_L3_cluster_DBCommon_arm_2_copy/1/)  |超时重跑    
    
    
,问题单1：    [https://pingcode.yasdb.com/pjm/items/664730a1288e1978208d4f92](https://pingcode.yasdb.com/pjm/items/664730a1288e1978208d4f92)    ?    
  #YDBRD-27215 【集群支持资源角色】Agile_L2_cluster_CT_gls_arm临时上车工程出现了”ckptUpdateInstPoint“、”ckptDequeue“、”ckptEnqueue“、”gcsCleanBlock"之类的core,问题单2：    [https://pingcode.yasdb.com/pjm/items/6647324f288e1978208d527d](https://pingcode.yasdb.com/pjm/items/6647324f288e1978208d527d)    ?    
  #YDBRD-27218 【集群支持资源角色】Agile_L2_cluster_heap_TX_1_debug_arm临时上车工程出现了"concatDtyBlkLists"的core,问题3：    [https://pingcode.yasdb.com/pjm/items/664f261b288e197820929f4b](https://pingcode.yasdb.com/pjm/items/664f261b288e197820929f4b)    ?    
  #YDBRD-28208 【集群支持资源角色】Agile_L3_cluster_DBCommon_arm_2_copy临时上车工程出现了"gcsDoInvalidateBlock"的core,问题4：    [https://pingcode.yasdb.com/pjm/items/66506aa2288e197820948136](https://pingcode.yasdb.com/pjm/items/66506aa2288e197820948136)    ?    
  #YDBRD-28334 【集群支持资源角色】Agile_L3_cluster_DBCommon_arm_2_copy临时上车工程出现了"gcsHandleReceiveBlock"的core,问题5：    [https://pingcode.yasdb.com/pjm/items/66506b98288e19782094834b](https://pingcode.yasdb.com/pjm/items/66506b98288e19782094834b)    ?    
  #YDBRD-28335 【集群支持资源角色】Agile_L3_cluster_DBCommon_arm_2_copy临时上车工程出现了"gcsCleanBlock"的core|  
|
|  
|  
|  [Agile_L3_cluster_DBCommon_arm_2_copy #2 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/copy_ms/job/Agile_L3_cluster_DBCommon_arm_2_copy/2/)  ||  
|
|  
|  
|  [Agile_L3_cluster_DBCommon_arm_2_copy #3 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/copy_ms/job/Agile_L3_cluster_DBCommon_arm_2_copy/3/)  ||  
|
|  
|  
|  [Agile_L3_cluster_DBCommon_arm_2_copy #4 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/copy_ms/job/Agile_L3_cluster_DBCommon_arm_2_copy/4/)  ||  
|
|  
|  
|  [Agile_L3_cluster_DBCommon_arm_2_copy #5 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/copy_ms/job/Agile_L3_cluster_DBCommon_arm_2_copy/5/)  ||  
|


  


  


  


## Attachments:

[image2024-5-29_16-9-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTY4OTcwYzJhZjRmNTIxMDM3IiwicmVmX2lkIjoiNjczOTZkMTY1OTNmOTljOWZmMjM3NzlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NzQ3LCJleHAiOjE3ODIzOTIxNDd9.4DQT-EVD6I51d7FAlMF3ieY979xDwqaDXdaisTN2vec)

 (image/png)    


[dev-resrole.wps](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTZhMWFkOWEzMzExZGM4ZWFhIiwicmVmX2lkIjoiNjczOTZkMTY1OTNmOTljOWZmMjM3NzlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NzQ3LCJleHAiOjE3ODIzOTIxNDd9.wI3ufiPf8IdselXa3xW54meL8R4WNxPcHYOloFEw0ZQ)

 (application/octet-stream)    


## Comments:

|  [](null)  ,一、会议时间：2024/5/10  周五：15：00-15：45,二、会议地点：腾讯会议,三、会议主持人：马爽,四、参会人员：陈宜顺、龙忠友、李道一、张丽红、牛亚娜、马爽,五、会议主题：  集群GCS支持资源角色测试详细设计评审,六、会议总结,1、v$buffer_control视图字段  PAST_COPY类型变更成BOOLEAN，涉及到P状态,2、gcs基础消息流场景遗漏预读block，需要补充    
  3、在观测资源状态的转换关系时，还需要关注Xowner的变更    
  （XGD→SGP，NGP→SGD的状态转换中XOwner转移，和之前机制不一样）    
  4、脏页刷盘场景不需要关注中间状态，只需要保证操作完成后角色资源状态正常    
  5、并发场景测试需要梳理四节点的gcs场景，可复用现有用例新增四节点工程,  
,  
,Posted by mashuang at 六月 17, 2024 11:56|
|---|
