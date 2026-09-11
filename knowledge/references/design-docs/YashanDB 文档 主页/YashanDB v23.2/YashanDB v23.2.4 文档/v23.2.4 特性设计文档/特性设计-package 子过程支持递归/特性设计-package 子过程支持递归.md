Created by 彭灵继, last modified on 九月 18, 2024

  


##   [1. 总述](#1-总述)  

package子过程支持递归。

###   [1.1 需求来源](#11-需求来源)  

需求来源     [YDBRD-26807 package子过程支持递归](https://pingcode.yasdb.com/pjm/items/66308cb1c36a3d30a860d4e8)  

###   [1.2 调研文档](#12-调研文档)  

当前通过对Oracle 的子过程递归场景测试，同时分析其内部视图做为部分分析参考的依据（具体细节省略）。

###   [1.3 需求分析](#13-需求分析)  

按子过程被调用的位置可分为：过程头部声明区，数据（变量）声明区，过程体。

按子过程的定义是否调用自身可分为：递归子过程（直接调用或间接）和非递归子过程。

综合上述的细分当前：

|子过程区域|非递归子过程|递归子过程|
|---|---|---|
|过程头部声明区|允许|不允许|
|数据（变量）声明区|允许|允许|
|过程体|允许|允许|


对于另外在可存在以下几种情况，出现的递归子过程当前也是不允许的：

- 匿名块当中出现的子过程
- package body当中的私有子过程
- 其他嵌套的子过程


|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|package 头部子过程支持递归|package 编译过程中将依赖Head声明的子过程信息进行编译|是|是|
|性能|性能场景1|-|否|是|
|可用性|恢复场景|-|否|否|
|可靠性|故障场景|-|否|否|
|可维可测|DFX功能1|通过obj$, dependency$ 观察对象状态及依赖关系|否|是|
|安全|安全场景1|-|否|否|
|易用性|-|-|否|否|
|可修改性|-|-|否|否|
|兼容性|-|-|否|否|
|周边配合|权限|-|否|否|
|周边配合|审计|-|否|否|
|周边配合|导入导出工具|-|否|否|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|obj#|内部系统表|无|oracle 当中可参考all_objects视图|
|dependency$|内部系统表|无|oracle 当中可参考all_dependencies视图|


###   [1.5 开源依赖](#15-开源依赖)  

无。

##   [2. 接口](#2-接口)  

接口无调整。

##   [3. 规格与约束](#3-规格与约束)  

1. 支持 出现在package 头部子过程在非过程声明区的直接或间接递归。
1. 对于package body或匿名块中的过程当前暂不支持直接或间接递归。


##   [4. 特性](#4-特性)  

###   [4.1 package 头部子过程支持递归](#41-package-头部子过程支持递归)  

1. 编译package子过程(verifyMethod) 阶段package body 编译只依赖package head(自身或其他）的有效声明，而不再依赖body是否存在或是否有效的状态；
1. 其中：package head有效声明是否package head自身编译通过且当前状态处于有效（PACK_READY)。如果无效或在上述过程中加入尝试重编译package head，如果重编译不通过，则会报头部无效。
1. 限制：package head 变量不能引用当前包的函数
1. 在执行package子过程阶段
1. 调用package 子过程时，会分别先后检查当前package head及body 是否处理有效状态： head无效则报错处理；body不存在则报错，失效状态则会尝试重新编译package body，编译不通过则报错处理。当head 及body处于有效状态，刚调用执行。
1. package namespace 的初始化：在执行阶段，当遇到package 的变量或子过程时会通过以下方式初始化当前包的namespace
1.     - 先后检查当前package head及body 是否处理有效状态：head无效则报错处理；body处于失效状态则会尝试重新编译package body，编译不通过则报错处理，编译通过则会重置已有的namespace内存空间。
    - 如果namespace 空间已存在，刚会分别检查head及body 区域的objectId, nsVersion是否一致。
    - head 和 body 区域一起进行初始化



###   [4.2 package 的失效](#42-package-的失效)  

1. 在verifyMethod的编译阶段，package的子过程依赖于自身的head或其他package的head，只依赖package head信息。
1. 当packge head 更改时，统一通过依赖失效机制失效相应package body.


###   [4.3 其他场景](#43-其他场景)  

1. 集群场景，同步依赖于package head，package body更改时同时body的定义。


###   [4.4 相较以前的变动](#44-相较以前的变动)  

1. 以前：对package 子过程被使用时，（编译）校验强依赖于对应的package body已编译通过（Ready); 现在：对package 子过程的编译使用只依赖于package head编译通过。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

自测关注点：

1. 支持场景：package 子过程头部间接递归、直接递归。
1. 不支持场景：package body及匿名块内的递归。
1. package head 变更的失效场景
1. package body 无效或不存在时编译场景
1. 级联失效的编译场景（主要是编译时间及是否可能有循环依赖等问题）


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[add_profile_pic.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZDA4OTcwYzJhZjRmNTIxNTVmIiwicmVmX2lkIjoiNjczOTZkZDA1OTNmOTljOWZmMjM3ZmVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExODI5LCJleHAiOjE3ODIzOTgyMjl9.DRe0cWF-leExJiU2gTqbjdB1R8FdrvC9wMH3SMT8_sg)

 (image/svg+xml)    


## Comments:

|  [](null)  ,1. package DDL 与package head是否不一致的问题。    
  2. 全局变量区的初始化与使用是否一致。    
  3. head 变量默认值引用子过程,Posted by penglingji at 五月 28, 2024 14:12|
|---|
