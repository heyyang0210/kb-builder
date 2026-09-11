IR链接

  [ https://pingcode.yasdb.com/ship/ideas/66d6763789f961f33010666c ](https://pingcode.yasdb.com/ship/ideas/66d6763789f961f33010666c)  ? #YASHAN-3276  【mysql兼容】MySQL支持按Collation比较字符串



# 1 简介



## 1.1 目的

Collation（排序规则）决定字符类型数据的比较和排序方式。对于多语言字符集的数据库来说，具有重要的实用价值，例如比较和排序时，是否区分大小写、重音以及某些语言特定的排序规划（如汉语拼音）。根据不同的比较规则，可定义不同类型的collation，简单的比较规则一般具有较好的性能，复杂的比较规则往往会带来更好的语言体验，但相对来说，比较的代价更大，性能更差。

YashanDB默认的collation为二进制类型，即对字符串逐字节比较，以确定相对大小。暂不支持在同一字符集下指定其他的collation。本需求的目的是，支持用户指定collation，并在对应场景下，按用户指定的collation及其衍生规则来对字符串类型做比较。



## 1.2 范围

本方案主要支持用户为表达式指定collation（包含显式指定和隐式指定），并在涉及比较和排序的场景下，推导并使用正确的collation。

同时，本方案还要提供必要的观测手段，用于辅助用户查看实际生效的collation。



# 2 需求概述

本需求的主要工作是，正确识别用户指定的collation，并将其作为表达式的属性，在语句Prepare阶段，对SQL语句中参与排序和比较的表达式做改写，从而使比较和排序的结果与collation预期行为一致。

1）SQL语句支持表达式和列的collation指定。

2）filter、物化等算子根据collation改写。



# 3 需求场景分析



## 3.1 需求来源

SQL标准支持collation，本方案参考Oracle与MySQL（两者实现方式大致一致，但细节上略有差异），行为以MySQL为准。



## 3.2 价值概述

SQL标准支持collation，YashanDB暂不支持，影响用户使用，特别是MySQL业务迁移。



## 3.3 需求场景分析

collation作为表达式的一个属性，最终影响字符串的比较和排序，每个表达式都将因为用户指定或继承取得一个collation。

### 3.3.1 指定方式

- 显式指定：即SQL语句在表达式中显式通过collate关键字来指定表达式的collation。
- 隐式继承：SQL语句中未指定，但表达式会通过继承的方式隐含collation属性。


### 3.3.2 collation继承层级

用户可以在不同的层级指定collation，高层级的collation会影响小层级的默认collation。对于表达式中的基本元素（最小粒度，不可分割的元素，如列、字面量、无参数的内置函数），其collation是固定值或通过继承获得。对于复杂表达式，如运算符和含参数的内置函数，其collation通过参数推导获得。

1. 列级——列的collation。
1. 表级——表的collation，决定表中的列的默认collation。
1. connection级——当前connection的collation，决定表达式默认的collation。
1. Schema级——当前Schema的collation，决定在该Schema中新建的表的collation。
1. 实例级——当前实例的collation，决定新建的schema的默认collation。


### 3.3.3 collation的强制性（coercibility)

由于在字符串比较场景下，参与比较的两个字符串可能来自两个表达式，两个表达式可能存在不同的collation，当collation不同时，会根据collation的来源确定优先级，再根据优先级来决定转换结果。

Coercibility表示不同Collation在操作中的优先级。优先级较高的Collation会被隐式转换为优先级较低的Collation，或直接决定最终操作的Collation。

|**优先级**|**MySQL**|
|---|---|
|**0**|显式  `COLLATE`  子句|
|**1**|不同Collation的字符串连接（如  `CONCAT`  ）|
|**2**|列、存储过程参数或局部变量|
|**3**|系统常量（如  `USER()`  函数结果）|
|**4**|字面值常量（如  `'abc'`  ）|
|**5**|数值或  `NULL`  |


例如，当会话的collation为utf8mb4_general_ci时，以下语句中，select 1 from 'a' collate utf8mb4_0900_ci > 'b'；由于'a'显式指定了collation为utf8mb4_0900_ci，因此优先级为0，而'b'未指定，因此其collation为utf8mb4_general_ci，优先级为4，因此‘b'的collation将隐式转换为'a'的collation，再做比较。

同一优先级，当collation不一致时，对于0级，会报错，其他优先级，会选择相对较严格的collation。



### 3.3.3 collation影响的场景

collation影响比较和排序的行为，以下其影响的场景：

|场景|范围|影响|
|---|---|---|
|where filter、join filter|比较、like、between、any等|比较需要按collation的行为执行|
|物化算子|group by、order by、distinct等|排序需要按collation的行为执行|
|约束|主键、唯一键、外键|需要按collation的行为确定两个值是否相同|
|索引|——|索引的数据需要按collation排序|
|内置函数|case when、min、max等|比较结果应符合collation预期|


根据collation的强制性及冲突处理策略，以上场景中，对于collation冲突并且无法转换的场景应当报错，否则应按collation预期输出结果。



## 3.4 需求影响分析

﻿

|||
|---|---|
|维度|说明|
|性能|性能指系统的响应能力，即要经过多长时间才能对某个事件做出响应，或者某段时间内系统所能处理的事件个数。  |
|可用性|可用性指系统能够正常运行的时间比例。经常用两次故障之间的时间长度或出现故障时系统恢复正常的速度来表示。 |
|可靠性|可靠性是软件系统在应用或系统错误面前，维持软件系统的功能特性的基本能力。|
|可测试性|可测试性指通过测试揭示软件缺陷的容易程度。|
|安全性|安全性指系统在向合法用户提供服务的同时能够阻止非授权用户使用的企图或拒绝服务的能力。安全性分析为必选项，不涉及要明确说明。|
|易用性|易用性指关注对用户来说完成某个期望任务的容易程度和系统所提供的用户支持的种类。|
|可修改性|可修改性指能够快速地以较高的性价比对系统进行变更的能力。|
|兼容性|兼容性指特性开发是否向前兼容，是否涉及升级。|


﻿



## 3.5 外部依赖分析（可选）

无



## 3.6 业内方案分析（可选）

从计算层的实现，理论上Oracle与MySQL没有太大差异。但存储层，由于索引数据需要按collation排序，而MySQL索引本身具备collation能力，因此在索引的数据比较阶段，可以调用collation对应的比较方法来对索引数据排序。而Oracle会对filter等算子做改写，将参与比较的expr改写为nlssort(expr, collation)。

例如，对于Binary_CI来说

select * from t1 where c1 > 'A', 将改写为以下语句：

select * from t1 where nlssort(c1, 'nls_sort=''BINARY_CI''') > hextoraw('6100') 。

由于BINARY_CI不区分大小写，因此 'A’和'a'的排序键值相同，即对应ascii码0x61, ('a', 'nls_sort=''BINARY_CI''')对应的结果为0x6100。

因此，原始filter c1 > 'A'，会被Oracle改写为 nlssort(c1, 'nls_sort=''BINARY_CI''') > nlssort('A', 'nls_sort=''BINARY_CI''')。



# 4 方案设计



## 4.1 方案概述

基于YashanDB现有能力，采用Oracle方案，工作量较小，并且易于稳定。但对于不同的collation支持nlssort函数的工作量较大，因此采用折中方案。即：

1）filter和物化算子采用改写方案，将原始表达式改写为与collation行为一致的collation sort函数。

2）对于与YashanDB默认collation(二进制比较)不一致的列，其索引统一修改为collation sort函数索引。

3）约束、内置函数中，涉及字符串参数比较的场景，需要适配，按collation比较。





## 4.2 设计原则（可选）



## 4.3 MySQL Collation

23.3、23.4版本需要支持的MySQL collation包含以下几类

|collation|行为特征|比较方法|filter及索引函数|
|---|---|---|---|
|utf8/gbk/gb18030/iso88591/ascii_bin|二进制比较，忽略尾部空格|实现内置的collation|trim|
|utf8_general_ci|大小写模糊比较|实现内置的collation|upper+trim|




## 4.4 比较和排序中的collation处理

物化算子改写为对原始表达式的collation sort函数结果做排序健。

filter中的比较改写为对左右两端的表达式的collation sort函数结果做比较。

由于索引的列改成了collation sort的函数索引，因此对于列的比较，由于filter改写后的表达式与索引的表达式一致，因此仍然可以选择该索引。

### 4.4.1 表达式collation推导

表达式的collation指表达式返回值的collation。表达式的collation来源有两类，即显式指定和隐式推导，显式指定会覆盖隐式推导的结果。

如select c1  collate utf8mb4_bin from t1;  由于对c1指定了显式的collation，因此，该查询返回的结果collation为utf8mb4_bin。

隐式推导规则如下：

|表达式类型|collation|其他|
|---|---|---|
|column|column定义的collation||
|运算符（+，-，*，/, mod等）|取coercibility较小的参数的collation|所有参数的collation不能有冲突|
|流程控制函数（case、if、ifnull、nullif)|从所有参与返回的参数中，取coercibility较小的参数的collation|以case when为例，参数分两类: 一类用于控制流程的分支，如when后的表达式，这些参数间可能会比较，因此要求collation不冲突，否则无法比较，但不影响返回结果的collation。另一类，如then后的表达式，可能作为返回值，会决定返回结果的collation|
|普通字符串处理函数|由参数确定||
|字面量|由会话参数确定||
|绑定参数|由会话参数确定|暂不支持单独指定绑定参数的collation。|


### 4.4.2 coercibility原则

对于一组表达式(expr1, expr2, expr3, ..., exprN)的collation推导，由于推导结果是单向的（coericibility取最小值，collation取更严格的模式），由于最终结果，由表达式顺序无关。因此，无论多少个表达式，最终都可简化为两个表达式的场景。

对于expr1, expr2

```
if (coercibility不一致) then 
	返回coercibility较小的表达式的coercibility及collation
else /* same coercibility */    
  if (collation一致) then        
  	  任意返回一个表达式的coercibility及collation    
  else if (expr1->coercibility == 0) then        
  	  collation冲突，并且无法调整，返回错误    
  else         
    if (两个collation均为bin or 均不为bin) then  
    	 collation冲突，并且无法调整，返回错误        
    else             
       返回collation为bin的collation及coercibility        
    end if    
  end if
endif
```



## 4.5 安全性设计

﻿

|||
|---|---|
|外部交互分析|需要关注仿冒、抵赖相关威胁分析。|
|数据流分析|需要关注篡改、信息泄露、拒绝服务分析。|
|处理过程分析|需要关注仿冒、篡改、抵赖、拒绝服务、权限提升分析。|
|数据存储分析|需要关注篡改、抵赖、信息泄露、决绝服务分析。|


﻿



## 4.6 其他DFX相关设计

已支持collation和coercibility函数，用于返回表达式的collation，以及表达式collation的强制性优先级，可用于辅助定位语句改写过程中，中间结果是否正确。



# 5 需求分解列表

﻿

||||
|---|---|---|
|分解特性SR|特性说明|工作量|
||||
||||


﻿

# 6 未来规划

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。



# 7 参考资料清单

当前概要设计参考了哪些输入、哪些调研材料，包括特性相关的历史文档链接。

设计工具图参考：  [ (584) 设计工具图类参考 | 知识管理 - PingCode ](https://pingcode.yasdb.com/wiki/spaces/CODPUBLIC/pages/673976a6728206efb92f6922)  



# 8 模版变更记录

正式设计文档请删除此章节