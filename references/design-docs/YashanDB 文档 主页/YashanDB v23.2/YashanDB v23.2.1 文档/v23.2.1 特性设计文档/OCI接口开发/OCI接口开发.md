Created by 侯忠林, last modified on 一月 12, 2024

*详细设计-YDBRD-23320 :oci接口开发剩余接口 *

*IR链接：*    [[YDBRD-23320] 【oci】基于zabbix oci接口开发剩余接口 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-23320)  

*SR链接：*    [[YDBRD-20701] OCI支持特定接口 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-20701)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

OCI（Oracle Call Interface）是oracle公司提供的开发基于Oracle数据库应用程序的底层接口，它具有速度快、支持第三代编程语言、对Oracle数据库的控制功能强等优点，加上oracle作为使用面积很大的数据库，其中OCI接口也有很大的使用面积，如果我们崖山需要支持替换oracle就必须得支持OCI接口的功能，用于让客户无缝替换OCI驱动，不用去修改程序。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

随着外场的使用增多，发现用户有很多是使用OCI接口规范开发的程序，所以崖山支持OCI接口的紧迫性就很高了，由于接口太多，所以目前就优先开发外场客户使用过的OCI接口。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**OCI接口的相关调研主要是对OCI接口的功能和场景包括异常，正常的所有场景进行调研，用于我们开发的支持。**

  [YDBRD-23320 OCI剩余接口调研 - 侯忠林 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=138567752)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  [YDBRD-23320 剩余OCI工作量分析 - 冯皓博 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135619006)  

需求功能就是完成上面文档中列出的所有OCI的接口功能。

###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无    [  
1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

接口依赖OCI的官方文档，但是已发布的接口一般不会更改，发布新的接口则需要我们继续支持OCI新的接口。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|OCIIntervalFromText|将字符串转换为OCIInterval|这块已实现区间类型为SQLT_INTERVAL_DS，此次需要实现区间类型SQLT_INTERVAL_YM的这部分。|是|
|OCIStringAssignText|将源文本字符串赋值给目标OCIString字符串|源字符串复制一份给OCIString字符串|是|
|OCIStringSize|获取给定OCIString字符串的大小|OCIString里面字符串的大小（字符）|是|
|OCIStringPtr|获取指向给定OCIString文本字符串的指针。|OCIString里面buff的地址|是|
|OCIStringAllocSize|获取已分配的字符串内存大小（字节）|OCIString里面buff的大小|是|
|OCIStringResize|调整给定字符串的内存大小（字节）|重置OCIString的buff大小，并清除内容|是|
|OCINumberToInt|将OCINumber转换为多种int|将OCINumber转换为8，16，32，64四种长度的int|是|
|OCINumberToText|将OCINumber转换为字符串|函数TO_NUMBER的反向功能|是|
|OCINumberFromText|将字符串转换为OCINumber|功能和函数TO_NUMBER的效果一样|是|
|OCINumberToReal|将OCINumber转换为float,double,long double|原始类型只支持float,double,long double三|是|
|OCINumberFromReal|将float,double,long double转换为OCINumber|原始类型只支持float,double,long double三种|是|
|OCILogon |创建一个简单的登录会话|等价于OCILogon2 中mode是  OCI_DEFAULT的模式，其他无差别|是|
|OCINlsGetInfo |获取本地化信息|本地化信息比较多|是|
|OCIDefineArrayOfStruct|指定静态数组定义所需的附加属性，用于数组结构（多行、多列）获取|多行fetch时用于指定写入下一行数据的间隔长度。|是|
|OCILobLocatorIsInit|判断给定的LOB是否已初始化|  
|是|
|OCILobWrite2|将缓冲区写入 LOB|更新LOB数据|是|
|OCILobOpen|打开LOB|崖山没有这个功能|是|
|OCILobClose|关闭LOB|崖山没有这个功能|是|
|OCILobIsOpen|判断LOB是否打开|崖山没有这个功能|是|
|OCILobTrim2|将 LOB 值截断为更短的长度|LOB 的新长度必须小于或等于当前长度|是|
|OCITerminate|从共享内存子系统中分离进程并释放共享内存。|崖山没有这个功能|是|
|OCIBindByName|通过名称在变量和 SQL 语句或 PL/SQL 代码块中的占位符之间创建关联。|需要支持通过名称和通过位置交叉绑定的先后顺序|是|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**无**

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

#### 1. OCIIntervalFromText

当给定一个区间字符串时，返回字符串所代表的区间。区间的类型就是结果描述符的类型。

##### 接口

sword OCIIntervalFromText ( void *hndl,     
  OCIError *err,     
  const OraText *inpstring,    
  size_t str_len,    
  OCIInterval *result );

##### 参数

hndl (IN) ：OCI 用户会话句柄或环境句柄

err (IN/OUT)：OCI 错误句柄

inpstring (IN)：输入字符串

str_len (IN)：输入字符串的长度

result (OUT)：返回的interval

##### 功能实现

此次需要实现OCIInterval类型为  SQLT_INTERVAL_YM的部分，年的区间为（-178000000-178000000  ）oracle为(–4713 to 9999)，月的区间为（0-11），数据库存储层有限制年在-100-100之间。

result不能是空指针，必须是通过OCIDescriptorAlloc接口alloc过的有效值。

C驱动方法：  YacResult yacYMIntervalFromText(YacHandle hEnv, YacYMInterval* ymInterval, const YacChar* str, YacUint32 strLen);

#### 2.OCIStringAssignText

将源文本字符串赋值给目标OCIString字符串

##### 接口

sword OCIStringAssignText ( OCIEnv *env,    
  OCIError *err,     
  const OraText *rhs,     
  ub4 rhs_len,    
  OCIString **lhs );

##### 参数

env (IN/OUT)：  OCI环境句柄

err (IN/OUT)：  OCI 错误句柄

rhs (IN)：赋值的右侧（源），文本或 UTF-16 Unicode 字符串

rhs_len (IN)：rhs 字符串的长度（字节）

lhs (IN/OUT)：赋值的左侧（目标）。如果 rhs 为 Unicode，则其缓冲区为 Unicode。

##### 功能实现

将 rhs 字符串赋值给 lhs 字符串。lhs 字符串的大小可根据 rhs 的大小进行调整。

lhs不能是NULL。

**目标字符串*lhs是NULL：**

1.此时源字符串  rhs不能是NULL,rhs_len不能是0,否则报错：错误的参数。

2.源字符串rhs不是NULL，则构造一个  OCIString结构体，  初始化一个buff空间（oracle36字节）并且将字符串拷贝到buff中。返回  OCIString的结构体指针赋值给*lhs。

**目标字符串*lhs不是NULL：**

1.源字符串长度rhs_len如果是0或者源字符串rhs是NULL,则目标字符串*lhs内部数据变成空串并且，buff大小不变。

2.  源字符串rhs不是NULL，则判断目前的buff能够放下当前字符串，如果能放下则不在重新alloc buff。如果放不下则重新alloc新的buff空间（buff空间扩展策略未知），buff地址会更换，并拷贝字符串。

3.rhs_len可以大于rhs的实际字符大小，小于则只拷贝rhs_len大小的数据，如果rhs_len大于则拷贝最大值（有可能直接越界拷贝），在  OCIStringSize时则为rhs_len长度，所以OCIString应该记录最新的rhs_len。

目前OCI接口没有计算字符对应字节长度的方法，并且OCIStringAssignText这个方法还是一个本地方法。

#### 3.OCIStringSize

获取OCIString里面字符串的大小（字符）

##### 接口

ub4 OCIStringSize ( OCIEnv *env,    
  const OCIString *vs );

##### 参数

env (IN/OUT)：OCI环境句柄

vs (IN)：返回字符串大小的字节数

##### 功能实现

返回  OCIString里面记录的rhs_len。返回的大小不包括结束符的额外字节。OCIString *vs可以是NULL，则返回0。

#### 4.OCIStringPtr

获取指向给定字符串文本的指针

##### 接口

text *OCIStringPtr ( OCIEnv *env,    
  const OCIString *vs );

##### 参数

env (IN/OUT)：OCI环境句柄

vs (IN)：返回字符串的 OCIString 对象的指针

##### 功能实现

返回  OCIString内部  buff的地址。如果buff为NULL，则返回NULL。

vs可以是NULL，返回的text *也是NULL。

#### 5.OCIStringAllocSize

获取已分配的字符串内存大小（字节）

##### 接口

sword OCIStringAllocSize ( OCIEnv *env,    
  OCIError *err,     
  const OCIString *vs,    
  ub4 *allocsize ); 

##### 参数

env (IN/OUT)：OCI环境句柄

err (IN/OUT)：OCI 错误句柄

vs (IN)：要返回字符串内存大小的OCIString。vs 参数必须是非空指针。

allocsize (OUT)：返回以字节为单位的字符串内存分配大小。

##### 功能实现

分配的大小大于或等于实际字符串大小。直接返回buff的大小，如果buff为NULL，则返回0。

#### 6.OCIStringResize

调整给定字符串的内存大小

##### 接口

sword OCIStringResize ( OCIEnv *env,    
  OCIError *err,    
  ub4 new_size,    
  OCIString **str );

##### 参数

env (IN/OUT)：OCI环境句柄

err (IN/OUT)：OCI 错误句柄

new_size (IN)：字符串的新内存大小（字节）。new_size 参数必须包含作为字符串结束符的空间。

str (IN/OUT)：要重置空间的OCIString

##### 功能实现

重新alloc新的buff，源buff直接释放，OCIStringsize重置为0。此函数调整对象缓存中给定长度可变字符串的内存大小。字符串的内容不会被保留。此函数可能会将字符串分配到一个新的内存区域，在这种情况下，给定字符串占用的原始内存将被释放。如果 str 为 NULL，此函数将为字符串分配内存。如果 new_size 为 0，则释放 str 占用的内存，并返回一个 NULL 指针值。

str不能为NULL，会core。*str可以为NULL，  则构造一个OCIString结构体，初始化一个new_size 的buff空间，但是OCIStringsize为0。

#### 7.OCINumberToInt

将   OCINumber   类型转换为整数

##### 接口

sword OCINumberToInt ( OCIError *err,    
  const OCINumber *number,    
  uword rsl_length,    
  uword rsl_flag,     
  void *rsl );

##### 参数

err (IN/OUT)：OCI 错误句柄

number (IN)：要转换的OCINumber 

rsl_length (IN)：预期结果的大小

rsl_flag (IN)：指定输出符号的标志：  OCI_NUMBER_UNSIGNED   无符号值，  OCI_NUMBER_SIGNED   有符号值

rsl (OUT)：要转换的结果的指针

##### 功能实现

这是一个本地类型转换函数。它将给定的  OCINumber   转换为8，16，32，64四种长度，带符号或者不带符号的int。需要在C驱动实现yac  NumberToInt的方法。

number不能为NULL

number如果是无效值则报异常：参数2是一个无效或未初始化的数值 （是否初始化崖山无法判断出是否是野指针）

C驱动方法：YacResult yacNumberToInt(const YacNumber* number, YacUint32 length, YacUint32 flag, YacPointer inum);

#### 8.OCINumberToText

根据指定格式将  OCINumber  转换为字符串。

##### 接口

sword OCINumberToText ( OCIError *err,    
  const OCINumber *number,     
  const OraText *fmt,     
  ub4 fmt_length,    
  const OraText *nls_params,     
  ub4 nls_p_length,    
  ub4 *buf_size,     
  OraText *buf );

##### 参数

err (IN/OUT)：OCI 错误句柄

number (IN)：要转换的OCINumber

fmt (IN)：转换格式

fmt_length (IN)：参数 fmt 的长度

nls_params (IN)：字符串的字符集（目前只支持当前会话字符集）。如果是 NULL 字符串（（text*）0），则使用会话的默认字符集。

nls_p_length (IN)：nls_params 参数的长度

buf_size (IN)：缓冲区的大小

buf (OUT)：将转换后的字符串要放入的缓冲区

##### 功能实现

number不能为NULL

number如果是无效值则报异常：参数2是一个无效或未初始化的数值

fmt格式不对：格式文本 [9966] 无效，解析数字大于fmt数字报：  文本转换时指定格式的数值导致溢出，和TO_NUMBER的fmt一样。

可以直接调用TO_NUMBER的反向功能接口codNumber2TextSciFormat。

#### 9.OCINumberFromText

将字符串转换为  OCINumber

##### 接口

sword OCINumberFromText ( OCIError *err,     
  const OraText *str,     
  ub4 str_length,    
  const OraText *fmt,    
  ub4 fmt_length,     
  const OraText *nls_params,     
  ub4 nls_p_length,     
  OCINumber *number );

##### 参数

err (IN/OUT)：OCI 错误句柄

str (IN)：要转换为  OCINumber  输入的字符串。

str_length (IN)：输入字符串的大小

fmt (IN)：转换格式

fmt_length (IN)：参数 fmt 的长度

nls_params (IN)：字符串的字符集（目前只支持当前会话字符集）。如果是 NULL 字符串（（text*）0），则使用会话的默认字符集。

nls_p_length (IN)：nls_params 参数的长度

number (OUT)：转换出来的  OCINumber值

##### 功能实现

fmt格式不对：格式文本 [9966] 无效，解析数字大于fmt数字报：  文本转换时指定格式的数值导致溢出，和TO_NUMBER的fmt一样。

功能和TO_NUMBER功能一样，可以直接调用TO_NUMBER的功能接口。

#### 10.OCINumberToReal

将  OCINumber  转换为实数（浮点）类型。

##### 接口

sword OCINumberToReal ( OCIError *err,    
  const OCINumber *number,    
  uword rsl_length,    
  void *rsl );

##### 参数

err (IN/OUT)：OCI 错误句柄

number (IN)：要转换的的OCINumber值

rsl_length (IN)：要转换的浮点数的大小，有效值 sizeof({float | double | long double})。long double我们没有这种类型

rsl (OUT)：转换出来的  实数（浮点）类型指针

##### 功能实现

rsl_length = sizeof({ float | double | long double}).

number不能为NULL

number如果是无效值则报异常：参数2是一个无效或未初始化的数值

根据rsl_length的不同判断不同的转换对象，需要C驱动实现对应的接口函数。

#### 11.OCINumberFromReal

将实数（浮点）类型转换为  OCINumber  。

##### 接口

sword OCINumberFromReal ( OCIError *err,    
  const void *rnum,    
  uword rnum_length,    
  OCINumber *number );

##### 参数

err (IN/OUT)：OCI 错误句柄

rnum (IN)：要转换的浮点数的指针

rnum_length (IN)：要转换的浮点数的大小，有效值 sizeof({float | double | long double})。long double 我们没有这种类型

number (OUT)：转换出来的OCINumber值

##### 功能实现

如果 number 或 rnum 为 NULL，或 rnum_length 等于零则报错

rsl_length = sizeof({ float | double | long double}).

根据rsl_length的不同判断不同的转换对象，需要C驱动实现对应的接口函数。

C驱动接口：  YacResult yacNumberFromReal(const YacPointer rsl, YacUint32 length, YacNumber* number)

#### 12.OCILogon

创建一个简单的登录会话

##### 接口

sword OCILogon ( OCIEnv *envhp,    
  OCIError *errhp,    
  OCISvcCtx **svchp,    
  const OraText *username,    
  ub4 uname_len,    
  const OraText *password,    
  ub4 passwd_len,    
  const OraText *dbname,    
  ub4 dbname_len );

##### 参数

envhp (IN)：OCI环境句柄

errhp (IN/OUT)：OCI 错误句柄

svchp (IN/OUT)：服务上下文指针

username (IN)：用户名。必须使用上次调用 OCIEnvNlsCreate() 时 charset 参数指定的编码。

uname_len (IN)：username 的长度（字节数），与编码无关。

password (IN)：用户密码。必须使用上次调用 OCIEnvNlsCreate() 时 charset 参数指定的编码。

passwd_len (IN)：password的长度（字节数），与编码无关。

dbname (IN)：要连接的数据库名称。必须使用上次调用 OCIEnvNlsCreate() 时的 charset 参数指定的编码。

dbname_len (IN)：dbname 的长度（字节数），与编码无关

##### 功能实现

等价于OCILogon2 中mode是  OCI_DEFAULT的模式，其他无差别，  OCILogon2已实现直接调用OCILogon2就行。

#### 13.OCINlsGetInfo

将区域设置信息从 OCI 环境或用户会话句柄复制到目标缓冲区指向的指定大小的数组中。

##### 接口

sword OCINlsGetInfo ( void *hndl,     
  OCIError *errhp,     
  OraText *buf,     
  size_t buflen,     
  ub2 item );

##### 参数

hndl (IN/OUT)：OCI 环境或用户会话句柄。

errhp (IN/OUT)：OCI 错误句柄

buf (OUT)：指向目标缓冲区的指针。返回的字符串有结束符。

buflen (IN)：目标缓冲区的大小。每条信息的最大长度为 OCI_NLS_MAXBUFSZ 字节。

item (IN)：指定要返回 OCI 环境句柄中的哪个项目。

##### 功能实现

目前只能支持中国大陆地区的本地环境，如下：

|item |说明|值|
|---|---|---|
|OCI_NLS_DAYNAME1|星期一的本地名称|星期一|
|OCI_NLS_DAYNAME2|星期二的本地名称|星期二|
|OCI_NLS_DAYNAME3|星期三的本地名称|星期三|
|OCI_NLS_DAYNAME4|星期四的本地名称|星期四|
|OCI_NLS_DAYNAME5|星期五的本地名称|星期五|
|OCI_NLS_DAYNAME6|星期六的本地名称|星期六|
|OCI_NLS_DAYNAME7|星期日的本地名称|星期日|
|OCI_NLS_ABDAYNAME1|星期一的本地缩写名称|星期一|
|OCI_NLS_ABDAYNAME2|星期二的本地缩写名称|星期二|
|OCI_NLS_ABDAYNAME3|星期三的本地缩写名称|星期三|
|OCI_NLS_ABDAYNAME4|星期四的本地缩写名称|星期四|
|OCI_NLS_ABDAYNAME5|星期五的本地缩写名称|星期五|
|OCI_NLS_ABDAYNAME6|星期六的本地缩写名称|星期六|
|OCI_NLS_ABDAYNAME7|星期日的本地缩写名称|星期日|
|OCI_NLS_MONTHNAME1|一月的本地名称|1月|
|OCI_NLS_MONTHNAME2|二月份的本地名称|2月|
|OCI_NLS_MONTHNAME3|三月的本地名称|3月|
|OCI_NLS_MONTHNAME4|四月份的本地名称|4月|
|OCI_NLS_MONTHNAME5|五月份的本地名称|5月|
|OCI_NLS_MONTHNAME6|六月的本地名称|6月|
|OCI_NLS_MONTHNAME7|七月份的本地名称|7月|
|OCI_NLS_MONTHNAME8|八月份的本地名称|8月|
|OCI_NLS_MONTHNAME9|九月份的本地名称|9月|
|OCI_NLS_MONTHNAME10|十月份的本地名称|10月|
|OCI_NLS_MONTHNAME11|十一月份的本地名称|11月|
|OCI_NLS_MONTHNAME12|十二月的本地名称|12月|
|OCI_NLS_ABMONTHNAME1|一月的本地缩写名称|1月|
|OCI_NLS_ABMONTHNAME2|二月份的本地缩写名称|2月|
|OCI_NLS_ABMONTHNAME3|三月的本地缩写名称|3月|
|OCI_NLS_ABMONTHNAME4|四月份的本地缩写名称|4月|
|OCI_NLS_ABMONTHNAME5|五月的本地缩写名称|5月|
|OCI_NLS_ABMONTHNAME6|六月的本地缩写名称|6月|
|OCI_NLS_ABMONTHNAME7|七月份的本地缩写名称|7月|
|OCI_NLS_ABMONTHNAME8|八月份的本地缩写名称|8月|
|OCI_NLS_ABMONTHNAME9|九月份的本地缩写名称|9月|
|OCI_NLS_ABMONTHNAME10|十月份的本地缩写名称|10月|
|OCI_NLS_ABMONTHNAME11|十一月份的本地缩写名称|11月|
|OCI_NLS_ABMONTHNAME12|十二月的本地缩写名称|12月|
|OCI_NLS_YES|本地表示肯定回答的字符串|yes|
|OCI_NLS_NO|本地表示否定回答字符串|no|
|OCI_NLS_AM|AM的本地等价字符串|上午|
|OCI_NLS_PM|PM的本地等价字符串|下午|
|OCI_NLS_AD|AD的本地等效字符串|公元|
|OCI_NLS_BC|BC的原生等价字符串|公元前|
|OCI_NLS_DECIMAL|小数字符|.|
|OCI_NLS_GROUP|组分隔符|   ,|
|OCI_NLS_DEBIT|贷方的本地符号|-|
|OCI_NLS_CREDIT|借方的本地符号|空串|
|OCI_NLS_DATEFORMAT|数据库日期格式|DD-MON-RR|
|OCI_NLS_INT_CURRENCY|国际货币符号|CNY|
|OCI_NLS_DUAL_CURRENCY|双币种符号|￥|
|OCI_NLS_LOC_CURRENCY|本地货币符号|￥|
|OCI_NLS_LANGUAGE|语言名称|SIMPLIFIED CHINESE|
|OCI_NLS_ABLANGUAGE|语言名称的缩写|ZHS|
|OCI_NLS_TERRITORY|领土名称|CHINA|
|OCI_NLS_CHARACTER_SET|字符集名称|ZHS16GBK|
|OCI_NLS_LINGUISTIC_NAME|语言分类名称|BINARY|
|OCI_NLS_CALENDAR|日历名称|GREGORIAN|
|OCI_NLS_WRITINGDIR|语言书写方向|LTR|
|OCI_NLS_ABTERRITORY|领土缩写|CN|
|OCI_NLS_DDATEFORMAT|数据库默认日期格式|DD-MON-RR|
|OCI_NLS_DTIMEFORMAT|数据库默认时间格式|   HH.MI.SS AM|
|OCI_NLS_SFDATEFORMAT|本地日期格式|%m/%d/%y|
|OCI_NLS_SFTIMEFORMAT|本地时间格式|   %H:%M:%S|
|OCI_NLS_NUMGROUPING|数字分组字段|空格|
|OCI_NLS_LISTSEP|列表分隔符|,|
|OCI_NLS_MONDECIMAL|十进制货币字符|.|
|OCI_NLS_MONGROUP|货币分组分隔符|,|
|OCI_NLS_MONGROUPING|货币分组字段|空格|
|OCI_NLS_INT_CURRENCYSEP|国际货币分隔符|空格|


#### 14.OCIDefineArrayOfStruct

指定静态数组定义所需的附加属性，用于数组结构（多行、多列）获取。

##### 接口

sword OCIDefineArrayOfStruct ( OCIDefine *defnp,    
  OCIError *errhp,    
  ub4 pvskip,     
  ub4 indskip,     
  ub4 rlskip,    
  ub4 rcskip );

##### 参数

defnp     (IN/OUT)：通过调用 OCIDefineByPos() 或 OCIDefineByPos2() 返回的定义结构的句柄。

errhp     (IN/OUT)：OCI 错误句柄

pvskip     (IN)：获取下一个数据值跳过的参数

indskip     (IN)：获取下一个指示器位置跳过的参数

rlskip     (IN)：获取下一个返回值长度跳过的参数

rcskip     (IN)：获取下一个返回值编码跳过的参数

##### 功能实现

该调用是在调用 OCIDefineByPos() 或 OCIDefineByPos2() 之后进行的。如果应用程序绑定的是涉及对象的结构数组，则必须先调用 OCIDefineObject() ，然后再调用 OCIDefineArrayOfStruct() 。

在  OCIDefine上记录一面的四个参数，默认为0，如果不为0则在多行fetch的时候跳过当前大小的空间写入下一个值。每次重新调用OCIDefineByPos或者其他相关的方法，则清除当前值。

#### 15.OCILobLocatorIsInit

测试给定的 LOB是否已初始化。

##### 接口

sword OCILobLocatorIsInit ( OCIEnv *envhp,    
  OCIError *errhp,    
  const OCILobLocator *locp,    
  boolean *is_initialized );

##### 参数

envhp (IN/OUT)：OCI 环境句柄

envhp (IN/OUT)：OCI 错误句柄

locp (IN)：要测试的LOB

is_initialized (OUT)：如果给定的 LOB 已初始化，则返回 TRUE；如果未初始化，则返回 FALSE。

##### 功能实现

locp不能是null，free以后的lob也可以用返回false。

直接判断  LOB  中的invalid字段就行。

#### 16.OCILobWrite2

将缓冲区写入 LOB

##### 接口

sword OCILobWrite2 ( OCISvcCtx *svchp,    
  OCIError *errhp,    
  OCILobLocator *locp,    
  oraub8 *byte_amtp,    
  oraub8 *char_amtp,    
  oraub8 offset,    
  void *bufp,     
  oraub8 buflen,    
  ub1 piece,    
  void *ctxp,     
  OCICallbackLobWrite2 (cbfp)    
  (    
  void *ctxp,    
  void *bufp,    
  oraub8 *lenp,    
  ub1 *piecep    
  void **changed_bufpp,    
  oraub8 *changed_lenp    
  )     
  ub2 csid,    
  ub1 csfrm );

##### 参数

svchp     (IN/OUT)：OCI服务上下文句柄

errhp (IN/OUT)：OCI错误句柄

locp     (IN/OUT)：要写入数据的LOB

byte_amtp     (IN/OUT)：IN - 要写入数据库的字节数。BLOB始终有用。对于 CLOB 和 NCLOB，只有 char_amtp 为 0 时才会使用。

char_amtp (IN/OUT)：  IN - 要写入数据库的最大字符数。BLOB忽略。OUT - 写入数据库的字符数。对于 BLOB 未定义。在轮询模式下，它是刚刚写入的长度（以字符为单位）。

offset     (IN)：  在输入时，它是从 LOB 值开始的绝对偏移量。对于字符型 LOB，它是从 LOB 开头算起的字符数；对于BLOB，它是字节数。第一个位置为 1。如果使用流式传输（轮询或回调），请在第一次调用中指定偏移量；在随后的轮询调用中，偏移量参数将被忽略。如果使用回调，则不需要偏移参数。

bufp     (IN)：写入数据的缓冲区指针。缓冲区中的数据长度假定为 buflen 中传递的值。即使使用轮询方法分块写入数据，在调用此调用时，bufp 也必须包含 LOB 的第一块数据。如果提供了回调，则不得使用 bufp 提供数据，否则会导致错误。

buflen     (IN)：缓冲区中数据的长度（以字节为单位）。当使用 char_amtp 参数以字符为单位指定数据量，而使用 buflen 参数以字节为单位指定数据量时，该值与 CLOB 和 NCLOB 的 char_amtp 值不同。

piece     (IN)：  缓冲区正在写入的哪一部分。该参数的默认值是 OCI_ONE_PIECE，表示缓冲区是以单块方式写入的。对于分片或回调模式，也可以使用以下其他值： OCI_FIRST_PIECE、OCI_NEXT_PIECE 和 OCI_LAST_PIECE。

ctxp     (IN)：回调函数的上下文。可以为空。

cbfp     (IN)：  可以注册的回调，用于在分片写入过程中调用。如果为空，则使用标准轮询方法。回调函数必须返回 OCI_CONTINUE 才能继续写入。如果返回任何其他错误代码，LOB 写入将被终止。回调函数需要以下参数

ctxp     (IN)：回调函数的上下文。可以为空。

bufp     (IN/OUT)：当前分片的缓冲指针。该指针与作为 OCILobWrite() 方法输入的 bufp 相同。

lenp     (IN/OUT)：缓冲区（IN）中数据的长度（字节），以及 bufp（OUT）中当前数据的长度（字节）。

piecep     (OUT)：当前的  piece   ：   OCI_NEXT_PIECE 或 OCI_LAST_PIECE

changed_bufpp (OUT)：如果回调函数希望使用新缓冲区来读取下一块数据，则可以输入新缓冲区的地址。如果该参数设置为 NULL，则使用默认的旧缓冲区 bufp。

changed_lenp (OUT)：新缓冲区的长度（如果提供）。

csid (IN)：缓冲区中数据的字符集 ID。如果该值为 0，那么 csid 将被设置为客户端的 NLS_LANG 或 NLS_CHAR 值，具体取决于 csfrm 的值。

csid (IN)：缓冲区数据的字符集形式。csfrm 参数必须与 LOB 类型一致。  csfrm 参数有两个可能的非零值：SQLCS_IMPLICIT - 数据库字符集 ID；SQLCS_NCHAR - NCHAR 字符集 ID。默认值为 SQLCS_IMPLICIT。

##### 功能实现

目前回调方式中的回滚没有办法实现（如果回调函数中没有提供到入参提供的大小数据长度，则报错并且把已经写入的数据回滚）

#### 17.OCILobOpen

打开LOB

##### 接口

sword OCILobOpen ( OCISvcCtx *svchp,    
  OCIError *errhp,    
  OCILobLocator *locp,    
  ub1 mode );

##### 参数

svchp (IN)：OCI服务上下文句柄

errhp (IN/OUT)：OCI错误句柄

locp (IN/OUT)：要打开的LOB

mode (IN)：打开 LOB的模式

##### 功能实现

locp不能为NULL，也必须指向一个有效LOB，否则报  OCI_INVALID_HANDLE。

校验完参数直接返回SUCCESS，崖山不支持此功能，默认打开。

#### 18.OCILobClose

关闭LOB

##### 接口

sword OCILobClose ( OCISvcCtx *svchp,    
  OCIError *errhp,    
  OCILobLocator *locp );

##### 参数

svchp (IN)：OCI服务上下文句柄

errhp (IN/OUT)：OCI错误句柄

locp (IN/OUT)：要关闭的LOB

##### 功能实现

locp不能为NULL，也必须指向一个有效LOB，否则报  OCI_INVALID_HANDLE。

校验完参数直接返回SUCCESS，崖山不支持此功能。

#### 19.  OCILobIsOpen

判断LOB是否打开

##### 接口

sword OCILobIsOpen ( OCISvcCtx *svchp,    
  OCIError *errhp,    
  OCILobLocator *locp,    
  boolean *flag );

##### 参数

svchp (IN)：OCI服务上下文句柄

errhp (IN/OUT)：OCI错误句柄

locp (IN/OUT)：LOB指针

flag (OUT)：如果LOB 已打开则返回 TRUE，否则返回 FALSE。

##### 功能实现

locp不能为NULL，也必须指向一个有效LOB，否则报  OCI_INVALID_HANDLE。校验完参数直接返回flag为TRUE，崖山不支持OPEN功能，默认打开。

#### 20.  OCILobTrim2 

将 LOB 值截断为更短的长度。

##### 接口

sword OCILobTrim2 ( OCISvcCtx *svchp,    
  OCIError *errhp,    
  OCILobLocator *locp,    
  oraub8 newlen );

##### 参数

svchp (IN)：OCI服务上下文句柄

errhp (IN/OUT)：OCI错误句柄

locp (IN/OUT)：LOB指针

newlen     (IN)：LOB 的新长度，必须小于或等于当前长度。对于字符 LOB，它是字符数；对于BLOB，它是字节数。

##### 功能实现

locp不能为NULL，也必须指向一个有效LOB，否则报  OCI_INVALID_HANDLE。

C驱动已经实现lobTrim方法直接封装。

#### 21.  OCITerminate 

从共享内存子系统中分离进程并释放共享内存

##### 接口

sword OCITerminate ( ub4 mode);

##### 参数

mode (IN)：调用  模式。有效值：OCI_DEFAULT - 执行默认调用。

##### 功能实现

该调用会尝试将进程从共享内存子系统中分离出来并将其关闭。它还会执行额外的进程清理操作。当连接到同一共享内存的两个或多个进程同时调用 OCITerminate() 时，速度最快的进程会完全释放共享内存子系统，速度较慢的进程必须终止。

崖山不支持此功能，直接返回成功。

#### 22.  OCIBindByName 

通过名称在变量和 SQL 语句中的占位符之间创建关联。

##### 接口

sword OCIBindByName ( OCIStmt *stmtp,     
  OCIBind **bindpp,    
  OCIError *errhp,    
  const OraText *placeholder,    
  sb4 placeh_len,    
  void *valuep,    
  sb4 value_sz,    
  ub2 dty,    
  void *indp,    
  ub2 *alenp,    
  ub2 *rcodep,    
  ub4 maxarr_len,    
  ub4 *curelep,     
  ub4 mode ); 

##### 参数

stmtp (IN/OUT)：正在处理的 SQL语句的语句句柄

bindpp (IN/OUT)：用于保存本调用隐式分配的绑定句柄的指针。绑定句柄保存了此特定输入值的所有绑定信息。当语句句柄被解除分配时，句柄会被隐式释放。在输入时，指针的值必须是 NULL 或有效的绑定句柄。

errhp (IN/OUT)：OCI错误句柄

placeholder (IN)：由名称指定的占位符，该占位符映射到与语句句柄相关联的语句中的变量。占位符的编码应始终与环境编码保持一致。

placeh_len (IN)：占位符中指定的名称长度，以字节数表示，与编码无关。

valuep (IN/OUT)：指向数据值或数据值数组的指针，其类型在 dty 参数中指定。

value_sz (IN)：该绑定变量的任何数据值（使用 valueep 传递）的最大可能大小（以字节为单位）。

dty (IN)：绑定值的数据类型。

indp (IN/OUT)：指向指示变量或数组的指针。

alenp (IN/OUT)：数组元素实际长度的指针。

rcodep (OUT)：指向列级返回代码数组的指针。动态绑定将忽略此参数。

maxarr_len (IN)：最大数组长度参数（用户数组可容纳的最大元素数）

curelep (IN/OUT)：当前数组长度参数（执行操作前或执行操作后数组中实际元素数量的指针）

mode (IN)：绑定模式，推荐的模式设置是 OCI_DEFAULT，这将使绑定变量的编码与其语句的编码相同。

##### 功能实现

byName和bypos按照绑定的顺序只生效最后一个

占位符只支持：name

如果名称不匹配在绑定的时候直接报：非法的变量名/编号

绑定的名称和位置本地解析

目前C驱动的实现支持不了此功能，本地解析参数名称的能力

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1. OCIIntervalFromText接口能够实现OCIInterval类型为SQLT_INTERVAL_YM的字符串转换，字符串中年区间大于9999，小于-4713，月的区间小于1大于12场景，result 为null场景。    
  2. OCIStringAssignText能够实现赋值给目标OCIString的基础能力，lhs是NULL则异常，*lhs是null情况下，rhs是NULL或者rhs_len是0则报错。给定rhs不为null，rhs_len为一部分长度，OCIString能够实现字符截取。*lhs不是null，rhs是NULL或者rhs_len是0，则OCIString变成空串，如果重复赋值，则bufer会自动调整大小。    
  3. OCIStringSize能够正确获取字符大小， *vs是NULL，则返回0    
  4. OCIStringPtr能够获取正确的字符串，并且重复获取，返回相同的字符串地址，如果OCIString的buff大小变化，则返回不通的地址。    
  5. OCIStringAllocSize能够获取正确的buff的大小，重复赋值则不会变化buff大小，resize后buff大小变化。    
  6. OCIStringResize能够重置buff大小，并且清除OCIString的内容，new_size为0，则释放str占用的内存，并返回一个NULL指针值。*str可以为NULL，返回一直已经分配空间的值。    
  7. OCINumberToInt能够将number转换成8，16，32，64四种长度，带符号或者不带符号的int，number不能为NULL，number如果是无效值则报异常。    
  8. OCINumberToText能够将正确值转换成fmt的格式，fmt转换格式不符合规范则异常，number是null或者无效值则报异常，解析数字大于fmt数字则异常。    
  9. OCINumberFromText能够将字符串转换成OCINumber,fmt转换格式不符合规范则异常,解析数字大于fmt数字则异常。    
  10. OCINumberToReal能够转换成float，double，long double三种类型。number为null异常，size不合法则异常，number是无效值异常。    
  11. OCINumberFromReal能够将float，double，long double三种类型转换成OCINumber，number 或 rnum 为 NULL，或 rnum_length 等于零则报错，size不合法则异常。

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

在OCI接口支持文档中，新增加以上OCI接口描述，参数说明。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

分迭代一点点支持剩余OCI的接口。