Created by 何阳, last modified on 六月 03, 2024

  


*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66276d9cfd997db58adfdd27](https://pingcode.yasdb.com/pjm/items/66276d9cfd997db58adfdd27)    *?*    
  *#YDBRD-26623 支持UTL_RAW内置系统包的RAW类型转换能力*

  


*参考文档：*

  [详解ORACLE的UTL_RAW包的各个函数](https://www.darkathena.top/archives/about-utl-raw-and-emulate-cal)  

  [oracle UTL_RAW](https://docs.oracle.com/database/timesten-18.1/TTPLP/u_raw.htm#i1004317)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

成熟模块的特性，概要设计和详细设计合一，必须说明本设计方案的需求来源，需求分析，功能概要描述。  **此类型设计文档要给出IR到SR拆分的依据。**

关键特性的SR设计，总述可以链接IR的概要设计文档，此处开始主要讲对应SR特性的需求范围。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

为了适配oracle 的UTL_RA_W内置系统包能力

**需求来源要说明特性支持的部署形态为 主备(单机)、分布式、集群**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**概述**     友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

我们对需求的分析，有相关联特性，可以附上关联文档。对交付特性涉及的质量属性各个方面进行概述，与第4章特性展开进行呼应。

**成熟模块的特性，需要考虑各质量属性的展开。**

**关键特性的SR设计，主要关注具体SR所承载的质量属性对应设计。其他章节可以不涉及。**

**功能属性**  ，需要遵循等价类正交划分的原则，考虑完备的拆分成多个子功能，每个子功能可以单独转测和上线，达到主体功能支撑IR到SR的拆分目的。

**非功能质量属性的理论知识指导，斜体内容正式文档可删除**

*（1）性能指系统的响应能力，即要经过多长时间才能对某个事件做出响应，或者某段时间内系统所能处理的事件个数。*     **例如执行表达式和算子类的特性需求，如果不选要给出充分理由。**

*（2）可用性指系统能够正常运行的时间比例。经常用两次故障之间的时间长度或出现故障时系统恢复正常的速度来表示。*     **例如OM、YCS等节点管理的特性需求，如果不选要给出充分理由**

*（3）可靠性是软件系统在应用或系统错误面前，维持软件系统的功能特性的基本能力。*     **例如主备、容灾、存储等的特性需求，如果不选要给出充分理由**

*（4）可测试性指通过测试揭示软件缺陷的容易程度。*     **特性如果不易观察时，要考虑增加DFX视图或者增加告警等手段**

*（5）安全性指系统在向合法用户提供服务的同时能够阻止非授权用户使用的企图或拒绝服务的能力。*     **例如协议、驱动、访问控制、通讯、加密等特性需求，如果不选要给出充分理由**

*（6）易用性指关注对用户来说完成某个期望任务的容易程度和系统所提供的用户支持的种类。*     **如何提升用户体验**

*（7）可修改性指能够快速地以较高的性价比对系统进行变更的能力。*     **后续追加特性的开发容易程度**

*（8）兼容性指特性开发是否向前兼容，是否涉及升级。*

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|子功能1|子功能1通过什么方案满足|是/否|是/否|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|是|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


|序号|函数/存储过程|类型|返回类型|说明|
|:---|:---|:---|:---|:---|
|1|BIT_AND   ( r1 IN RAW, r2 IN RAW) |计算|RAW|两个RAW按位逻辑“与“，返回RAW值|
|2|BIT_COMPLEMENT  ( r IN RAW) |计算|RAW|RAW按位逻辑“补码”，返回RAW值|
|3|BIT_OR   ( r1 IN RAW, r2 IN RAW) |计算|RAW|两个RAW按位逻辑“或“，返回RAW值|
|4|BIT_XOR   ( r1 IN RAW, r2 IN RAW) |计算|RAW|两个RAW按位逻辑“异或”|
|5|COMPARE  ( r1 IN RAW, r2 IN RAW, pad IN RAW DEFAULT NULL)|计算|NUMBER|比较两个RAW值。如果它们的长度不同，则根据可选的pad参数在右侧扩展较短的那个。|
|6|CONCAT  T(r1 IN RAW, r2 IN RAW, r3 IN RAW,…)|计算|RAW|将多个RAW连接成一个RAW值|
|7|COPIES  ( r IN RAW, n IN NUMBER) |转换|RAW|这个函数返回n个连接在一起的RAW，n必须是正值|
|8|LENGTH  ( r IN RAW) |计算|NUMBER|以字节为单位返回RAW的长度|
|9|SUBSTR  ( r IN RAW, pos IN BINARY_INTEGER, len IN BINARY_INTEGER DEFAULT NULL) |转换|RAW|这个函数返回len字节，从RAW r开始|
|10|CAST_TO_RAW  ( c IN VARCHAR2) |转换|RAW|将使用一定数量的数据字节表示的VARCHAR2值转换为具有该数量的数据字节的RAW值。不以任何方式修改数据本身，但将其数据类型重新转换为RAW数据类型|
|11|CAST_TO_VARCHAR2  ( r IN RAW) |转换|VARCHAR2|将使用一定数量的数据字节表示的RAW值转换为具有该数量的数据字节的VARCHAR2值。|
|12|CAST_TO_BINARY_INTEGER  ( r IN RAW, endianess IN PLS_INTEGER DEFAULT BIG_ENDIAN) |转换|BINARY_INTEGER|将BINARY_INTEGER的RAW二进制表示形式转换为BINARY_INTEGER。|
|13|CAST_FROM_BINARY_INTEGER  ( n IN BINARY_INTEGER , endianess IN PLS_INTEGER DEFAULT BIG_ENDIAN) |转换|RAW|返回BINARY_INTEGER值的RAW二进制表示形式。|
|14|CAST_TO_BINARY_DOUBLE  ( r IN RAW endianess IN PLS_INTEGER DEFAULT 1) |转换|BINARY_DOUBLE|将BINARY_DOUBLE的原始二进制表示形式强制转换为BINARY_DOUBLE|
|15|CAST_TO_BINARY_FLOAT   ( r IN RAW, endianess IN PLS_INTEGER DEFAULT 1) |转换|BINARY_FLOAT|将BINARY_FLOAT的RAW二进制表示形式转换为BINARY_FLOAT。|
|16|CAST_FROM_BINARY_FLOAT  ( n IN BINARY_FLOAT, endianess IN PLS_INTEGER DEFAULT 1) |转换|RAW|返回BINARY_FLOAT值的RAW二进制表示形式。|
|17|CAST_TO_NUMBER  ( r IN RAW) |转换|NUMBER|将NUMBER的原始二进制表示形式转换为NUMBER。|
|18|CAST_FROM_NUMBER   ( n IN NUMBER)|转换|RAW|返回NUMBER值的RAW二进制表示形式。|
|19|REVERSE  ( r IN RAW) |转换|RAW|将RAW r中的字节序列从头到尾进行反转。|


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- 查询的表为列表时，函数里表达式为列表的column时，报错，如果表达式是常量，可以执行
- 入参为  binary integer，超过边界值时，还在number取值范围内，  取其边界值，即超过2147483647，取2147483647，超过-2147483648，取-2147483648，超过number取值范围，报错
- 入参为number类型时，范围为[1E-130, 1E126），当入参为number，输入为1E126时，会先提升到double，然后转换成number类型，cast_from_number,入参为1E126不会报错，与oracle不一致
- 入参为  FLOAT时，取值范围可以超过number取值范围，与oracle不一致的地方，不报错
- 入参为DOBLE时，可以超过Double的上下限值，与oracle不一样的地方，不报错
- CAST_TO_BINARY_INTEGER，入参RAW类型，4个有效字节，如果入参超过4字节，报错，如果是大端序，在高位补0到4个字节，如果是小端序，在低位补0到4个字节
- CAST_TO_BINARY_FLOAT，4个有效字节，入参小于4字节，报错，超过4字节，先在高位补齐0成完整的16进制格式RAW，取高位4字节
- CAST_TO_BINARY_DOUBLE，8个有效字节，入参小于8字节，报错，如果超过8字节，先在高位补齐0成完整的16进制格式RAW，然后取高8字节
- cast_to_varchar2函数，当输入超过32000字节，报错，oracle会做截断处理。


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

代码实现基于现有的高级包框架，新增高级包参考文档：    [新增高级包流程](https://conf.yasdb.com/pages/viewpage.action?pageId=150628649)  

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

*场景描述，通过用例图，或者通过用例描述。必选*

*静态组织结构，通过逻辑视图或者ER图呈现。*

*建议选用数据流图、流程图或者活动图说明清楚特性处理流程，涉及多线程/多对象参与的，可增加顺序图/时序图。必选*

*存在状态机切换的，需要考虑状态转换图或者状态图。*

**详细设计和概要设计的主要区别是通过详细设计方案指导代码可落地。所以要具体到代码的数据结构、代码流程指导和跟框架如何结合。**

*如果概设和详细设计统一，需要展开对各SR进行阐述*

###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    RAW类型介绍

RAW类型类似于CHAR，申明方式为RAW（L)，L为长度，作为数据库列，最大为2000，作为变量，最大为32767

  


#### 4.3.1 CAST_FROM_NUMBER   ( n IN NUMBER)

语法

```
UTL_RAW.CAST_FROM_NUMBER (
n IN NUMBER)
RETURN RAW;

```

  


参数

|参数|描述|
|---|---|
|n|number类型的值|


  


对于number类型，oracle对于正数和负数是分别进行了存储转换

正数：加1存储

负数：被101减，如果总长度小于21字节，最后一个字节为102（为了排序处理）

Oracle上存储一个number数字，需要的存储空间是一个1到21字节的变长空间，其表示公式：

number = Σa  i   * 100   Exp - (i - 1)  

其中   **i**   表示的是数字位下标

Exp：用第0个字节的存储空间存储指数位，其中第1位表示符号位，如果是1表示正数，0表示负数，其余7位表示指数大小

第一个字节的第一个位是符号:1表示正数，0表示负数。其他7位表示指数的形式为:(exponent  100  )+64表示正数，255-((exponent  100  )+64)表示负数。

从第二个字节开始的其他字节给出数字的尾数(以100为基数)。每个字节代表一个从00到99的数字。如果X是尾数的第n个数的值(以100为基数)，如果(整)数为正，则其表示值(存储的值)为X+1，如果为负，则为101-X

**示例**

123456.7891 = 1234567891 * 100  2

-123456.7891 = -1234567891 * 100  2

```
SQL&gt; select dump(123456.7891) from dual;

DUMP(123456.7891)
-------------------------------
Typ=2 Len=6: 195,13,35,57,79,92



&lt;指数&gt;     195 - 193 = 2
&lt;数字1&gt;    13 - 1    = 12 *100^(2-0) 120000
&lt;数字2&gt;    35 - 1    = 34 *100^(2-1) 3400
&lt;数字3&gt;    57 - 1    = 56 *100^(2-2) 56
&lt;数字4&gt;    79 - 1    = 78 *100^(2-3) .78
&lt;数字5&gt;    92 - 1    = 91 *100^(2-4) .0091

```

负数：

```
SQL&gt; select dump(-123456.7891) from dual;

DUMP(-123456.7891)
----------------------------------
Typ=2 Len=7: 60,89,67,45,23,10,102

&lt;指数&gt;     62- 60= 2
&lt;数字1&gt;    101- 89    = 12 *100^(2-0) 120000
&lt;数字2&gt;    101 - 67    = 34 *100^(2-1) 3400
&lt;数字3&gt;    101 - 45    = 56 *100^(2-2) 56
&lt;数字4&gt;    101 - 23    = 78 *100^(2-3) .78
&lt;数字5&gt;    101 - 10    = 91 *100^(2-4) .0091
&lt;数字6&gt;    总长度小于21，最后一个字节为102

```

anchorbase的number表达格式：(参考：    [NUMBER](/pages/createpage.action?spaceKey=YAS&title=NUMBER)    )

number表示范围[1E-130, 1E126);

```
// 128 bits
typedef struct StCodLargeInt 
{
    CodUint64 item64[2];
} CodLargeInt;

typedef struct StCodNumber {  
    CodLargeInt value; // 128bit,可以存储38位十进制数值
    CodInt8     sign;  // 符号位
    CodUint8    unused;
    CodInt16    exp;   // 指数位
} CodNumber;

```

decimal = (-1)  sign   * (item64[0] + item64[1] * 2  64  ) *   10  exp

anchorbase内核的number数据类型的跟oracle的表达格式有点差距，需要做下转换，转换成以100为基底的格式。

exp分成两种情况，一种是偶数，一种是奇数

- 当exp % 2 == 0时，等价于exp = 2N，其中N为整数
- 当exp % 2 != 0时，等价于exp = 2N+1，其中N为整数   


得到以100为基底的指数

将number类型转换成字符串，CodText text

将其表示为以100为基底的指数形式，

当text.len % 2 == 0时，有2个整数位，则可以将字符串，以每两位转换成一个数字 Var[i]

当text.len % 2 != 0时，有1个整数位，第0个字符，转换成数字，其余以每两位转换成一个数字 Var[i]

X = text.len / 2; // X标配是数字位个数

- 当sign 为0时


指数位 = N + 193 + X - 1

数字位 = Var[i] + 1 // i表述第i个数字位

- 当sign 不为0时


指数位 = 60 + N + X - 1

数字位 = 101 - Var[i]

总长度小于21，最后一个字节为102

  


  


```
CodResult doCastFromNum(CodNumber number, CodChar* buf, CodUint32* size);

```

#### 4.3.2 CAST_TO_NUMBER  ( r IN RAW)

算法参考 CAST_FROM_NUMBER，逆向操作

-正数    
  指数 = 第一个字节 - 193    
  数字位 = 第i个字节 - 1

  


- 负数    
  指数 = 62 - 第一个字节    
  数字位 = 101 - 第i个字节    
  如果bytes字节小于等于21个字节，最末尾必须是0x66表示，超过22字节不需要表示


语法：

```
UTL_RAW.CAST_TO_NUMBER (
   r  IN RAW) 
 RETURN NUMBER;

```

参数

|参数|描述|
|---|---|
|r|数字的二进制表示形式|


  


#### 4.3.3   CAST_TO_RAW  ( c IN VARCHAR2)

将varchar2类型的数据的二进制数据格式输出，数据没有任何变化，只是将raw类型转换成varchar格式进行输出

语法

```
UTL_RAW.CAST_TO_RAW (
   c  IN VARCHAR2) 
RETURN RAW;

```

参数

|参数|描述|
|---|---|
|  `c`  |将VARCHAR2更改为RAW|


####   
  4.3.4   CAST_TO_VARCHAR2  ( r IN RAW)

使用数据库默认的字符集转换成VARCHAR2格式

```
UTL_RAW.CAST_TO_VARCHAR2 (
   r IN RAW) 
RETURN VARCHAR2;

```

  


参数

|参数|描述|
|---|---|
|  `r`  |RAW(不带前导长度字段)将被更改为VARCHAR2|


#### 返回值

|返回|描述|
|---|---|
|  `VARCHAR2`  |包含与输入RAW相同的数据|
|  `NULL`  |包含与输入RAW相同的数据|


#### 4.3.5 CAST_FROM_BINARY_INTEGER  ( n IN BINARY_INTEGER , endianess IN PLS_INTEGER DEFAULT BIG_ENDIAN) 

**语法**

```
UTL_RAW.CAST_FROM_BINARY_INTEGER (
   n          IN BINARY_INTEGER
   endianess  IN PLS_INTEGER DEFAULT BIG_ENDIAN) 
RETURN RAW;

```

  


**参数**

|参数|描述|
|---|---|
|  `n`  |  `BINARY_INTEGER`     值  .|
|  `endianess`  |表示端序的BINARY_INTEGER值。该函数识别已定义的常量big_endian (1)， little_endian(2)和machine_endian(3)。默认值是big_endian。machine_endian的设置与大端序机器上的big_endian具有相同的效果，或者与小端序机器上的little_endian具有相同的效果。|


  


**返回值**

BINARY_INTEGER值的二进制表示形式

  


输出为二进制的RAW类型

- 当n不为空时，endianess的取值范围为1,2,3
- 当n为空时，endianess的取值范围是合法的number值
- endianess的默认值为1（1：大端，2：小端，3：当前机器的大小端）


算法：

将十进制的整数转换成二进制数据的十六进制格式形式，最长只能是4个字节。n in binary integer范围为   -2147483648~2147483647，

当超过了这个范围，取其边界值，即超过2147483647，取2147483647，超过-2147483648，取-2147483648

**示例：**

```
SQL&gt; select utl_raw.cast_from_binary_integer(13423,1)  from dual;

UTL_RAW.CAST_FROM_BINARY_INTEGER(13423,1)
--------------------------------------------------------------------------------
0000346F

SQL&gt; select utl_raw.cast_from_binary_integer(13423,2)  from dual;

UTL_RAW.CAST_FROM_BINARY_INTEGER(13423,2)
--------------------------------------------------------------------------------
6F340000

SQL&gt; select utl_raw.cast_from_binary_integer(13423,3)  from dual;

UTL_RAW.CAST_FROM_BINARY_INTEGER(13423,3)
--------------------------------------------------------------------------------
6F340000


```

  


#### 4.3.6 CAST_TO_BINARY_INTEGER(  r   IN RAW,   endianess   IN BINARY_INTEGER DEFAULT 1)

**语法**

```
UTL_RAW.CAST_TO_BINARY_INTEGER (
   r          IN RAW
   endianess  IN PLS_INTEGER DEFAULT BIG_ENDIAN) 
RETURN BINARY_INTEGER;

```

**参数**

|Parameter|Description|
|---|---|
|  `r`  |BINARY_INTEGER的二进制表示|
|  `endianess`  |表示大端或小端架构的PLS_INTEGER。默认为大端序。|


  


**返回值**

BINARY_INTEGER值

  


函数为  CAST_FROM_BINARY_INTEGER的逆向操作

用法:第1个参数为要进行转换的raw，第2个参数为大端还是小端，默认大端为1,小端为2,传3为取机器配置的端

第2个参数可以是小数，会自动转换成int格式，强转为int格式的值为1,2,3即可，其他值报错

第1个参数可以为空，当第一个参数为空时，第2个参数的值只要是数值即可

  


#### 4.3.7 CAST_TO_BINARY_DOUBLE  (   r   IN RAW,   endianess   IN BINARY_INTEGER DEFAULT 1)

**语法**

```
UTL_RAW.CAST_TO_BINARY_DOUBLE (
   r          IN RAW
   endianess  IN PLS_INTEGER DEFAULT 1) 
RETURN BINARY_DOUBLE;

```

#### 参数

|参数|描述|
|---|---|
|  `r`  |BINARY_DOUBLE类型的二进制表示|
|  `endianess`  |表示大端或小端架构的PLS_INTEGER。默认为大端序。|


#### 返回值

   BINARY_DOUBLE   值.

  


IEEE 7  54规定了四种表示浮点数值的方式：单精确度（32位）、双精确度（64位）

Value = sign x exponent x fraction

- endianess取值范围同上面的函数一样
- r IN RAW必须是一个合法的十六进制的RAW，否则报错
- r IN RAW为NULL时，返回值为NULL，endianess需要是合法的数字即可
- n   IN BINARY_FLOAT


  


#### 4.3.8 CAST_TO_BINARY_FLOAT  (   r   IN RAW,   endianess   IN BINARY_INTEGER DEFAULT 1)

```
UTL_RAW.CAST_TO_BINARY_FLOAT (
   r          IN RAW
   endianess  IN PLS_INTEGER DEFAULT 1) 
RETURN BINARY_FLOAT;

```

#### 参数

|参数|描述|
|---|---|
|  `r`  |BINARY_FLOAT的二进制表示|
|  `endianess`  |表示大端或小端架构的PLS_INTEGER。默认为大端序。|


**返回值**

BINARY_FLOAT值

#### 4.3.9 CAST_FROM_BINARY_FLOAT   (  n   IN BINARY_FLOAT,   endianess   IN BINARY_INTEGER DEFAULT 1)

**语法**

```
UTL_RAW.CAST_FROM_BINARY_FLOAT(
   n          IN BINARY_FLOAT,
   endianess IN PLS_INTEGER DEFAULT 1) 
RETURN RAW;

```

#### 参数

|Parameter|Description|
|---|---|
|  `n`  |  `BINARY_FLOAT`     值|
|  `endianess`  |表示端序的BINARY_INTEGER值。该函数识别已定义的常量big_endian (1)， little_endian(2)和machine_endian(3)。默认值是big_endian。machine_endian的设置与大端序机器上的big_endian具有相同的效果，或者与小端序机器上的little_endian具有相同的效果。|


  


**返回值**

**BINARY_FLOAT值的二进制表示形式(RAW)，如果输入为NULL，则为NULL。**

  


#### 4.3.10   CAST_FROM_BINARY_DOUBLE   (  n   IN BINARY_DOUBLE,   endianess   IN BINARY_INTEGER DEFAULT 1)

**语法**

```
UTL_RAW.CAST_FROM_BINARY_DOUBLE(
   n          IN BINARY_DOUBLE,
   endianess IN PLS_INTEGER DEFAULT 1) 
RETURN RAW;

```

  


**参数**

|参数|描述|
|---|---|
|  `n`  |  `BINARY_DOUBLE`     值|
|  `endianess`  |表示端序的BINARY_INTEGER值。该函数识别已定义的常量big_endian (1)， little_endian(2)和machine_endian(3)。默认值是big_endian。machine_endian的设置与大端序机器上的big_endian具有相同的效果，或者与小端序机器上的little_endian具有相同的效果。|


  


**返回值**

BINARY_DOUBLE值的二进制表示形式，如果输入为NULL，则为NULL

  


###   [4.3](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)     序列化和反序列化

分布式部署模式，需要新增内置高级包函数的序列化和反序列化处理流程

###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

  


###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

高级包功能，自测场景中包含各种边界处理

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

无特殊处理，跟其他的高级包处理方式一样

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

**用例文件：**

```
--- 1.cast_from_binary_integer
select utl_raw.cast_from_binary_integer(13423,1)  as a from dual;
select utl_raw.cast_from_binary_integer(13423,1.6)  as a from dual;
select utl_raw.cast_from_binary_integer(13423,2)  as a from dual;
select utl_raw.cast_from_binary_integer(13423,2.6)  as a from dual;
select utl_raw.cast_from_binary_integer(13423,3)  as a from dual;
select utl_raw.cast_from_binary_integer(1E125,1)  as a from dual;
select utl_raw.cast_from_binary_integer(1E126,1)  as a from dual;
select utl_raw.cast_from_binary_integer(1E-130,1)  as a from dual;
select utl_raw.cast_from_binary_integer(1E-130,1.1)  as a from dual;
select utl_raw.cast_from_binary_integer(1E-130,3.6)  as a from dual;

select utl_raw.cast_from_binary_integer(NULL,1)  as a from dual;
select utl_raw.cast_from_binary_integer(NULL,2)  as a from dual;
select utl_raw.cast_from_binary_integer(NULL,3)  as a from dual;
select utl_raw.cast_from_binary_integer(NULL,4)  as a from dual;
select utl_raw.cast_from_binary_integer(NULL,1E126)  as a from dual;

--- errors
select utl_raw.cast_from_binary_integer(13423,4)  as a from dual;

--- 2.cast_from_binary_float
select utl_raw.cast_from_binary_float(123.45,1) as a from   dual;
select utl_raw.cast_from_binary_float(123.45,2) as a from   dual;
select utl_raw.cast_from_binary_float(123.45,3) as a from   dual;
select utl_raw.cast_from_binary_float(-123.45678,1) as a from   dual;
select utl_raw.cast_from_binary_float(-123.45678,2) as a from   dual;
--- success
select utl_raw.cast_from_binary_float(1E126,3) as a from   dual;


--- 3.cast_from_binary_double
select utl_raw.cast_from_binary_double(123.45, 1) as a from dual;
select utl_raw.cast_from_binary_double(123.45, 2) as a from dual;
select utl_raw.cast_from_binary_double(NULL, 1E125) as a from dual;


--- 4.cast_to_binary_double
select utl_raw.cast_to_binary_double(utl_raw.cast_from_binary_double(123.45, 2), 1) as a from dual;
select utl_raw.cast_to_binary_double(utl_raw.cast_from_binary_double(123.45, 2), 2) as a from dual;


--- 5.cast_to_binary_float
select utl_raw.cast_to_binary_float('6F340000', 1) as a from dual;
select utl_raw.cast_to_binary_float('6F34000', 1) as a from dual;
select utl_raw.cast_to_binary_float('06F34000', 1) as a from dual;
select utl_raw.cast_to_binary_float('C2F6E9DF', 1) as a from dual;
select utl_raw.cast_to_binary_float('DFE9F6C2', 2) as a from dual;

--- 6.cast_to_binary_integer
select utl_raw.CAST_TO_BINARY_INTEGER('0000346F', 1) as a from dual;
select utl_raw.CAST_TO_BINARY_INTEGER('6F340000', 2) as a from dual;
select utl_raw.CAST_TO_BINARY_INTEGER('6F3', 2) as a from dual;
select utl_raw.CAST_TO_BINARY_INTEGER('06F3', 2) as a from dual;
select utl_raw.CAST_TO_BINARY_INTEGER('06F30000', 2) as a from dual;
select utl_raw.CAST_TO_BINARY_INTEGER('6F3', 1) as a from dual;
select utl_raw.CAST_TO_BINARY_INTEGER('06F3', 1) as a from dual;
select utl_raw.CAST_TO_BINARY_INTEGER('000006F3', 1) as a from dual;
--- 6.1 error
select utl_raw.CAST_TO_BINARY_INTEGER('06F3000001', 2) as a from dual;
select utl_raw.CAST_TO_BINARY_INTEGER('06F3000001', 1) as a from dual;


--- 7.utl_raw.cast_from_number
select utl_raw.cast_from_number(0) as a from dual;
select utl_raw.cast_from_number(123456.789) as a from dual;
select utl_raw.cast_from_number(123456.7891) as a from dual;
select utl_raw.cast_from_number(-123456.789) as a from dual;
select utl_raw.cast_from_number(-123456.7891) as a from dual;
select utl_raw.cast_from_number(18446744073709551615) as a from dual;
select utl_raw.cast_from_number(18446744073709551616) as a from dual;
select utl_raw.cast_from_number(-18446744073709551615) as a from dual;
select utl_raw.cast_from_number(-18446744073709551616) as a from dual;
select utl_raw.cast_from_number(NULL) as a from dual;

--- 8.utl_raw.cast_to_number
select utl_raw.cast_to_number(utl_raw.cast_from_number(123456.789)) as a from dual;
select utl_raw.cast_to_number(utl_raw.cast_from_number(-123456.789)) as a from dual;
select utl_raw.cast_to_number(utl_raw.cast_from_number(18446744073709551615)) as a from dual;
select utl_raw.cast_to_number(utl_raw.cast_from_number(-18446744073709551616)) as a from dual;
select utl_raw.cast_to_number('35533922395E405C2E555666') as a from dual;

--- 21 bytes
select utl_raw.cast_to_number('35533922395E405C2E5556101010101010101066') as a from dual;
--- 22 bytes
select utl_raw.cast_to_number('35533922395E405C2E555610101010101010101066') as a from dual;
select utl_raw.cast_to_number('35533922395E405C2E555610101010101010101010') as a from dual;
--- over 22bytes
select utl_raw.cast_to_number('35533922395E405C2E55561010101010101010101010') as a from dual;

--- error
--- 20 bytes
select utl_raw.cast_to_number('35533922395E405C2E5556101010101010101061') as a from dual;

--- 22 bytes
select utl_raw.cast_to_number('35533922395E405C2E5556101010101010101010101') as a from dual;


--- 8.cast_to_raw
select utl_raw.cast_to_RAW('是')  as a from dual;
select utl_raw.cast_to_RAW(NULL)  as a from dual;
select utl_raw.cast_to_RAW('aA1234567890')  as a from dual;


--- 9.cast_to_varchar2
select utl_raw.cast_to_varchar2(utl_raw.cast_to_RAW('是'))  as a from dual;


create table tb_utl_raw(r1 int, r2 varchar(20));
insert into tb_utl_raw values(1, '1234');
insert into tb_utl_raw values(2, '');
select utl_raw.cast_from_number(r1) from tb_utl_raw;
select utl_raw.cast_from_number(123456) from tb_utl_raw;
drop table tb_utl_raw;
```

用例 & 预期结果：

|序号|测试函数|场景|预期结果|备注|进度|
|---|---|---|---|---|---|
|1|所有函数类型|边界值|预期成功，预期报错|  
|  
|
|2|所有函数类型|RAW作为入参，size长度为2000，入参为合法的16进制表示的RAW类型|预期成功|  
|  
|
|3|所有函数类型|RAW作为入参，size长度为2001，入参为合法的16进制表示的RAW类型|预期报错，RAW类型不支持|  
|  
|
|4|CAST_FROM_NUMBER|入参设置为number的最大最小值，边界值，正值，负值|预期成功，结果与oracle保持一致|  
|  
|
|5|CAST_TO_NUMBER|入参RAW为合法的值，且转换出来的是正值|预期成功|  
|  
|
|6|CAST_TO_NUMBER|入参RAW为合法的值，且转换出来的是负值|预期成功|  
|  
|
|7|CAST_TO_NUMBER|入参RAW前22字节为合法值，超过22字节，小于2000字节，后面也是合法二进制|预期成功|  
|  
|
|8|CAST_TO_NUMBER|入参RAW为不合法的二进制，  **需要进一步展开**|预期报错|  
|  
|
|9|CAST_FROM_BINARY_FLOAT|float的边界值，超过边界值，endianess为1,2,3以及1到3的小数|预期成功|  
|  
|
|10|CAST_FROM_BINARY_FLOAT|float的边界值，超过边界值，endianess取值范围不在[1,3]内|预期报错|  
|  
|
|11|CAST_FROM_BINARY_FLOAT|入参为空值，endianess为合法的数值|预期成功|  
|  
|
|12|CAST_TO_BINARY_FLOAT|入参为4字节以内合法二进制|预期成功|  
|  
|
|13|CAST_TO_BINARY_FLOAT|入参为奇数位的二进制格式的字符串|预期成功|  
|  
|
|14|CAST_TO_BINARY_FLOAT|入参超过4字节以内合法二进制|预期成功|  
|  
|
|15|CAST_FROM_BINARY_DOBLE|参考CAST_FROM_BINARY_FLOAT|  
|  
|  
|
|16|CAST_TO_BINARY_DOBLE|参考  CAST_TO_BINARY_FLOAT|  
|  
|  
|
|17|CAST_TO_RAW|入参为varchar类型，varchar类型范围边界|预期成功|  
|  
|
|18|CAST_TO_VARCHAR2   |入参raw，范围边界|预期成功|  
|  
|


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-4-28_10-4-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNTNhMWFkOWEzMzExZGM5MDc0IiwicmVmX2lkIjoiNjczOTZkNTM3MjgyMDZlZmI5MmYxZDg4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NDQyLCJleHAiOjE3ODIzOTM4NDJ9.eD2MtqfnIo2dYHrSGkeshjX7BYtD75Gs-bZaf-8i6dg)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要：    
  参与人员：王海峰 施新华 李潮 汪少华 何阳    
  时间：2024-5-9 11:00~12:00    
  会议形式：线上会议,1.根据anchorbase数据库的数据类型定义，确定行为哪些是跟oracle不一致的，写到规格约束中    
  2.错误码跟PL/SQL内置异常保持对应关系，新增错误码，需要注意，代码参考so_exception.c    
  3.USE_NATIVE_TYPE 建库参数，测试时需要注意这两种情况,Posted by heyang at 五月 09, 2024 11:56|
|---|
