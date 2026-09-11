Created by 未知用户 (liaofeng), last modified by  曾思尹 on 一月 18, 2024

#   [DBMS_LOB高级包 Design（DBMS_LOB高级包方案设计）](#dbms-lob高级包-designdbms-lob高级包方案设计)  

SR链接：

  [YDBRD-13360](https://jira.yasdb.com/browse/YDBRD-13360?src=confmacro)    -  DBMS_LOB的临时LOB创建释放函数  完成

  [YDBRD-13361](https://jira.yasdb.com/browse/YDBRD-13361?src=confmacro)    -  DBMS_LOB的LOB打开关闭函数  完成

  [YDBRD-22218](https://jira.yasdb.com/browse/YDBRD-22218?src=confmacro)    -  DBMS_LOB的LOB读写函数  完成

  [YDBRD-22219](https://jira.yasdb.com/browse/YDBRD-22219?src=confmacro)    -  DBMS_LOB的LOB处理函数  完成

##   [1. Overview（概述）](#1-overview概述)  

支持DBMS_LOB高级包，包括14个新增子过程和3个常量。

|子过程|temp lob的创建和释放    
    
    
|createtemporary|
|---|---|---|
|||freetemporary|
|||istemporary|
||lob读写|read|
|||write|
|||append|
|||writeappend|
|||copy|
||lob的打开和关闭|open|
|||close|
|||isopen|
||lob处理|erase|
|||trim|
|||instr|
|常量|lob size最大值,amount, offset参数|lobmaxsize = 2^63-1,即bigint最大值|
||temp lob持续时间,createtemporary dur参数|~~session = 10~~|
|||~~call = 12~~|
||以何种模式打开lob,open   open_mode  参数|lob_readonly = 0|
|||lob_readwrite = 1|


##   [2. Features（功能特性）](#2-features功能特性)  

若无特殊说明，下述的invalid temp lob定位符仅为freetemporary输出的temp lob定位符。

###   [2.1 CREATETEMPORARY Procedure](#21-createtemporary-procedure)  

**1. 功能**

创建长度为0的临时lob（isNull为false）。

**2. 语法**

```
DBMS_LOB.CREATETEMPORARY (
   lob_loc  IN OUT  BLOB/CLOB,
   cache    IN      BOOLEAN DEFAULT FALSE,
   dur      IN      INTEGER DEFAULT 10);

```

**3. 参数**

- lob_loc: LOB定位符。数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW/NCLOB/NCHAR/NVARCHAR。
- cache：保留字段，仅语法兼容。BOOLEAN类型或可隐式转换为BOOLEAN类型的参数。不可为NULL。
- dur：保留字段，仅语法兼容。INTEGER类型或可隐式转换为INTEGER类型的参数，参数的数值范围为INTEGER类型的数值范围。不可为NULL。


**4. 规格限制**

###   [2.2 FREETEMPORARY Procedure](#22-freetemporary-procedure)  

**1. 功能**

释放临时 lob，将 lob 定位符置为invalid。

**2. 语法**

```
DBMS_LOB.FREETEMPORARY (
   lob_loc  IN OUT  BLOB/CLOB); 

```

**3. 参数**

- lob_loc：有效的temp lob定位符。BLOB/CLOB/NCLOB类型。不可为NULL。


**4. 规格限制**

- 非temp lob定位符在本过程中视为invalid temp lob定位符。


###   [2.3 ISTEMPORARY Function](#23-istemporary-function)  

**1. 功能**

判断 lob 是否为临时 lob。

**2. 语法**

```
DBMS_LOB.ISTEMPORARY (
   lob_loc  IN  BLOB/CLOB)
RETURN INTEGER; 

```

**3. 参数**

- lob_loc：LOB定位符。BLOB/CLOB/CHAR/VARCHAR/RAW/NCLOB/NCHAR/NVARCHAR类型。


**4. 返回值**

- 如果给定的lob_loc参数值为NULL，则返回NULL。
- 如果 lob 是valid temp lob，则返回1。
- 如果 lob 是invalid temp lob，则返回0。
- 如果给定的lob_loc不是temp lob，则返回0。


**5. 规格限制**

- lob_loc参数输入常量NULL，函数返回NULL。


###   [2.4 OPEN Procedure](#24-open-procedure)  

**1. 功能**

以指定的模式（只读、读写）打开 lob。

**2. 语法**

```
DBMS_LOB.OPEN (
   lob_loc    IN OUT  BLOB/CLOB,
   open_mode  IN      INTEGER);

```

**3. 参数**

- lob_loc：未打开的LOB定位符。数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW/NCLOB/NCHAR/NVARCHAR，不可为NULL。不可为invalid temp lob定位符。
- open_mode：用只读或读写模式打开。不可为NULL。INTEGER类型或可隐式转换为INTEGER类型的参数，参数的数值范围为INTEGER类型的数值范围。DBMS_LOB.LOB_READONLY=0，只读模式。DBMS_LOB.LOB_READWRITE=1，读写模式。其他值都默认为只读模式。


**4. 规格限制**

- temp lob的open状态与事务无关。knl lob的open状态与lob的table id + row id + col id绑定，只读模式的open状态根据执行open时是否处于事务处理中分别记录其open状态，读写模式的open只能在事务处理中执行成功，knl lob在事务处理和不在事务处理的open状态记录各自独立。
- 在没有使用select for update的情况下，open不支持列存的knl lob in row。


###   [2.5 CLOSE Procedure](#25-close-procedure)  

**1. 功能**

关闭之前打开的 lob。

**2. 语法**

```
DBMS_LOB.CLOSE (
   lob_loc  IN OUT  BLOB/CLOB); 

```

**3. 参数**

- lob_loc：已打开的LOB定位符。BLOB/CLOB/NCLOB类型，不可为空。不可为invalid temp lob定位符。需要是已打开的lob，否则报错。


**4. 规格限制**

- CHAR、VARCHAR、NCHAR、NVARCHAR、RAW类型参数，报错是未打开的lob变量。
- 在没有使用select for update的情况下，close不支持列存的knl lob in row。


###   [2.6 ISOPEN Function](#26-isopen-function)  

**1. 功能**

判断 lob 是否处于打开状态，打开的 lob 返回1，否则返回0。

**2. 语法**

```
DBMS_LOB.ISOPEN (
   lob_loc  IN  BLOB/CLOB) 
RETURN INTEGER; 

```

**3. 参数**

- lob_loc：LOB定位符。数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW/NCLOB/NCHAR/NVARCHAR，不可为NULL。CHAR/VARCHAR/RAW/NCHAR/NVARCHAR等类型隐式转换为未打开的temp lob。不可为invalid temp lob定位符。


**4. 返回值**

- 对于打开的lob，返回1，否则返回0。


**5. 规格限制**

- 对于knl lob，打开的状态与lob相关而不是与定位符相关。例如：locator1打开了lob，并指向了一个knl lob，当locator2指向同一个knl lob时，locator2的打开状态是和locator1相同的。
- 在没有使用select for update的情况下，isopen不支持列存的knl lob in row。


###   [2.7 READ Procedure](#27-read-procedure)  

**1. 功能**

将指定部分的 lob 数据读取到buffer中。

**2. 语法**

```
DBMS_LOB.READ (
   lob_loc  IN      BLOB,
   amount   IN OUT  BIGINT,
   offset   IN      BIGINT,
   buffer   OUT     RAW);

or

DBMS_LOB.READ (
   lob_loc  IN      CLOB,
   amount   IN OUT  BIGINT,
   offset   IN      BIGINT,
   buffer   OUT     VARCHAR);

```

**3. 参数**

- lob_loc：待读取的LOB定位符。BLOB/CLOB/CHAR/VARCHAR/RAW/NCLOB/NCHAR/NVARCHAR类型。不可为NULL。不可为invalid temp lob定位符。
- amount：(IN)读取字节/字符数 (OUT)实际读取到的字节/字符数。INTEGER或可以隐式转换为INTEGER类型的参数。不可为NULL。合法范围为[1, 32000]。出参最大为buffer的size。
- offset：读取起点的偏移量（BLOB字节/CLOB字符数）。INTEGER或可以隐式转换为INTEGER类型的参数。不可为NULL，合法范围为[1, LOB长度]。
- buffer：RAW/VARCHAR。读操作的输出缓冲区。读BLOB，buffer数据类型支持RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR（RAW到HEX的转换）；读CLOB，buffer数据类型支持CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW（HEX到RAW的转换）。


**规格限制**

- buffer的size小于实际读取的字节数，报错。


###   [2.8 WRITE Procedure](#28-write-procedure)  

**1. 功能**

将buffer中指定部分的数据写入到 lob 的指定位置。

**2. 语法**

```
DBMS_LOB.WRITE (
   lob_loc  IN OUT  BLOB,
   amount   IN      BIGINT,
   offset   IN      BIGINT,
   buffer   IN      RAW);

or 

DBMS_LOB.WRITE (
   lob_loc  IN OUT  CLOB,
   amount   IN      BIGINT,
   offset   IN      BIGINT,
   buffer   IN      VARCHAR);

```

**3. 参数**

- lob_loc：待写入的LOB定位符。数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW/NCLOB/NCHAR/NVARCHAR。不可为NULL。不可为invalid temp lob定位符。
- amount：写入字节（BLOB）/字符（CLOB）数。BIGINT类型。合法范围为[1, buffer size]，其他情况报错。不可为NULL。
- offset：写入起点的偏移量。BIGINT类型。合法范围[1, LOBMAXSIZE]。不可为NULL。
- buffer：写操作的输入缓冲区。写BLOB时，buffer支持RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR（HEX到RAW的转换）类型。写CLOB时，buffer支持CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW（RAW到HEX的转换）类型。不可为NULL，如果是LOB类型，不可使用invalid temp lob定位符。


**4. 规格限制**

- 如果amount大于buffer中的数据大小，则会出现错误。
- 如果amount小于buffer中的数据大小，则只写入buffer中前amount个字节/字符到lob。
- 如果指定的偏移量超出了LOB中当前数据的末尾，则会补充零字节（写blob）或空格字符（写clob/nclob）到offset再写入数据。
- write不支持列存的lob。


###   [2.9 APPEND Procedure](#29-append-procedure)  

**1. 功能**

将src_lob的数据附加到dest_lob。

**2. 语法**

```
DBMS_LOB.APPEND (
   dest_lob  IN OUT  BLOB, 
   src_lob   IN      BLOB); 

or

DBMS_LOB.APPEND (
   dest_lob  IN OUT  CLOB, 
   src_lob   IN      CLOB); 

```

**3. 参数**

- dest_lob：待附加数据的目标LOB定位符。数据类型可为BLOB/RAW、CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR。不可使用invalid temp lob定位符。
- src_lob：待读取数据的源LOB定位符。数据类型可为BLOB/RAW、CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR。不可使用invalid temp lob定位符。


**4. 规格限制**

- dest_lob和src_lob需要同时为BLOB/RAW，或者同时为CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR。
- append(dest_lob)不支持列存的lob。


###   [2.10 WRITEAPPEND Procedure](#210-writeappend-procedure)  

**1. 功能**

将buffer中指定部分的数据附加到 lob。

**2. 语法**

```
DBMS_LOB.WRITEAPPEND (
   lob_loc  IN OUT  BLOB, 
   amount   IN      BIGINT, 
   buffer   IN      RAW); 

or

DBMS_LOB.WRITEAPPEND (
   lob_loc  IN OUT  CLOB, 
   amount   IN      BIGINT, 
   buffer   IN      VARCHAR); 

```

**3. 参数**

- lob_loc：待写入的LOB定位符。数据类型支持BLOB/CLOB/VARCHAR/RAW/NCLOB/NVARCHAR，不可为空。不可为invalid temp lob定位符。
- amount：写入字节（BLOB）/字符数（CLOB）。不可为空。整数数值范围[1, buffer size]。
- buffer：写操作的输入缓冲区。写BLOB，数据类型支持RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR（HEX到RAW的转换）；写CLOB/NCLOB，数据类型支持CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW（RAW到HEX的转换），不可为空，不可为invalid temp lob定位符。


**4. 规格限制**

- writeappend不支持列存的lob。


###   [2.11 COPY Procedure](#211-copy-procedure)  

**1. 功能**

将src_lob指定部分的数据拷贝到dest_lob的指定位置。

**2. 语法**

```
DBMS_LOB.COPY (
  dest_lob     IN OUT  BLOB,
  src_lob      IN      BLOB,
  amount       IN      BIGINT,
  dest_offset  IN      BIGINT DEFAULT 1,
  src_offset   IN      BIGINT DEFAULT 1);

or

DBMS_LOB.COPY (
  dest_lob     IN OUT  CLOB,
  src_lob      IN      CLOB,
  amount       IN      BIGINT,
  dest_offset  IN      BIGINT DEFAULT 1,
  src_offset   IN      BIGINT DEFAULT 1);

```

**3. 参数**

- dest_lob：复制目标LOB的LOB定位符。数据类型为BLOB/RAW、CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR。不可为NULL。不可为invalid temp lob定位符。
- src_lob：复制源LOB的LOB定位符。数据类型为BLOB/RAW、CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR。不可为NULL。不可为invalid temp lob定位符。
- amount：复制的字节（对于BLOB）或字符（对于CLOB）数。BIGINT或可隐式转换为BIGINT类型的其他类型。整数数值范围[1, DBMS_LOB.LOBMAXSIZE]，不可为NULL。
- dest_offset：复制开始时目标LOB中的偏移量（以字节或字符为单位）。BIGINT或可隐式转换为BIGINT类型的其他类型。未指定参数时，默认值为1。整数数值范围[1, LOBMAXSIZE]，不可为NULL。
- src_offset：复制开始时源LOB中的偏移量（以字节或字符为单位）。BIGINT或可隐式转换为BIGINT类型的其他类型。未指定参数时，默认值为1。整数数值范围[1, DBMS_LOB.LOBMAXSIZE]，不可为NULL。


**4. 规格限制**

- 如果在目标LOB中指定的偏移量超出了该LOB中当前数据的末尾，则会补充零字节（写blob）或空格字符（写clob/nclob）到dest_offset再写入数据。
- 根据src_offset和amount参数取源LOB字节或字符，当源LOB剩余字节或字符数不满足amount时，amount按实际取到的字节或字符数计算并参与后续的写入目标LOB。
- 当src_offset超过源LOB末尾时，不会改变dest_lob的内容。
- copy(dest_lob)不支持列存的lob。


###   [2.12 ERASE Procedure](#212-erase-procedure)  

**1. 功能**

擦除 lob 中指定部分的数据。

**2. 语法**

```
DBMS_LOB.ERASE (
   lob_loc  IN OUT  BLOB/CLOB,
   amount   IN OUT  BIGINT,
   offset   IN      BIGINT DEFAULT 1);

```

**3. 参数**

- lob_loc：待擦除的LOB定位符。数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW/NCLOB/NCHAR/NVARCHAR，不可为NULL。不可为invalid temp lob定位符。
- amount：BIGINT类型或可隐式转换为BIGINT类型的其他类型。（IN）擦除字节/字符数。整数数值范围[1, IN: LOBMAXSIZE]，不可为空。（OUT）实际擦除字节/字符数。
- offset：擦除起点的偏移量（字节/字符数）。BIGINT类型或可隐式转换为BIGINT类型的其他类型。整数数值范围[1, LOBMAXSIZE]，不可为空。


**4. 规格限制**

- 从LOB中间擦除数据时，将分别为BLOB或CLOB写入零字节填充符或空格。当擦除LOB的一部分时，LOB的长度不会减少。
- 如果在擦除指定长度的数据之前达到LOB的末尾，则实际擦除的字节或字符数可能与amount参数指定的数字不同。实际擦除的字符或字节数在amount参数中返回。
- erase不支持列存的lob。


###   [2.13 TRIM Procedure](#213-trim-procedure)  

**1. 功能**

将 lob 长度修剪为指定长度。

**2. 语法**

```
DBMS_LOB.TRIM (
   lob_loc  IN OUT  BLOB/CLOB,
   newlen   IN      BIGINT);

```

**3. 参数**

- lob_loc：待修剪的LOB定位符。数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW/NCLOB/NCHAR/NVARCHAR，不可为空。不可为invalid temp lob定位符。
- newlen：修剪后LOB的新长度（BLOB字节/CLOB字符数）。BIGINT类型或可隐式转换为BIGINT类型的其他类型。整数数值范围[0, lob length]。不可为空。


**4. 规格限制**

- trim不支持列存的lob。


###   [2.14 INSTR Function](#214-instr-function)  

**1. 功能**

返回 lob 中pattern第n次出现的匹配位置，从指定的偏移量开始。

**2. 语法**

```
DBMS_LOB.INSTR (
   lob_loc  IN  BLOB,
   pattern  IN  RAW,
   offset   IN  BIGINT DEFAULT 1,
   nth      IN  BIGINT DEFAULT 1)
RETURN BIGINT;

or

DBMS_LOB.INSTR (
   lob_loc  IN  CLOB,
   pattern  IN  VARCHAR,
   offset   IN  BIGINT DEFAULT 1,
   nth      IN  BIGINT DEFAULT 1)
RETURN BIGINT;

```

**3. 参数**

- lob_loc：待匹配的LOB定位符。数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW/NCLOB/NCHAR/NVARCHAR。
- pattern：用于匹配的pattern。匹配BLOB，数据类型支持RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR；匹配CLOB/NCLOB，数据类型支持RAW/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR。
- offset：匹配起点的LOB偏移量。整数范围[1, LOBMAXSIZE]，当offset>lob_length且不超出数值范围时，函数返回0。
- nth：第n个匹配。整数范围[1, LOBMAXSIZE]，当nth大于实际能匹配上的最大个数且不超出数值范围时，函数返回0。


**4. 返回值**

返回第n个匹配上的pattern首部在LOB中的偏移量，如果未找到则返回0，如果参数为NULL、为invalid temp lob定位符或超出数值范围(数字溢出会报错)则返回NULL。

**5. 规格限制**

- pattern长度限制为32000字节。
- lob_loc参数输入常量NULL，函数返回NULL。


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
// DBMS_LOB.CREATETEMPORARY
static CodResult bipVerifyCreateTemporary(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeCreateTemporary(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecCreateTemporary(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.FREETEMPORARY
static CodResult bipVerifyFreeTemporary(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeFreeTemporary(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecFreeTemporary(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.ISTEMPORARY
static CodResult bipVerifyIsTemporary(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeIsTemporary(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecIsTemporary(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.OPEN
static CodResult bipVerifyOpen(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeOpen(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecOpen(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.CLOSE
static CodResult bipVerifyClose(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeClose(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecClose(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.ISOPEN
static CodResult bipVerifyIsOpen(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeIsOpen(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecIsOpen(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.READ
static CodResult bipVerifyRead(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeRead(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecRead(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.WRITE
static CodResult bipVerifyWrite(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeWrite(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecWrite(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.APPEND
static CodResult bipVerifyAppend(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeAppend(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecAppend(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.WRITEAPPEND
static CodResult bipVerifyWriteAppend(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeWriteAppend(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecWriteAppend(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.COPY
static CodResult bipVerifyCopy(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeCopy(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecCopy(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.ERASE
static CodResult bipVerifyErase(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeErase(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecErase(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.TRIM
static CodResult bipVerifyTrim(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeTrim(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecTrim(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_LOB.INSTR
static CodResult bipVerifyInstr(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeInstr(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecInstr(AnlStmt* stmt, ExprNode* node, Variant* retValue)

```

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

**LOB分类**

临时LOB    
  temp lob in row：<=32000字节    
  temp lob out row：>32000字节

持久LOB    
  knl lob in row：<=4000字节（包括head，即LobCoupon.data前占12字节）    
  knl lob out row：>4000字节

**v$temporary_lobs视图**

|字段|含义|
|---|---|
|SID|会话ID|
|CACHE_LOBS|保留字段，值为0|
|NOCACHE_LOBS|通过调用dbms_lob.createtemporary显式创建的临时lob数量|
|ABSTRACT_LOBS|隐式创建的，存储在vm上的临时lob数量(暂不统计，值为0)|


**DBMS_LOB Exception**

|异常|错误码|说明|
|---|---|---|
|DBMS_LOB.INVALID_ARGVAL|ERR_ANS_EXEC_ARUMENT_OUT_OF_RANGE|参数值超出范围|
|NO_DATA_FOUND|ERR_PL_NO_DATA_FOUND|read过程中offset大于lob长度，无数据可读取|
|DBMS_LOB.UNOPENED_FILE|ERR_ANK_CLOSE_UNOPENED_LOB|close过程中lob未打开，无法执行close操作|
|VALUE_ERROR|ERR_PL_INVALID_NULL_ARG|参数值为NULL|


###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1 DBMS_LOB相关数据结构](#521-dbms-lob相关数据结构)  

LOB数据结构如下

```
// lob变量
typedef struct StVarLob {
    CodUint8*   data;
    CodUint32   size;
    CodPointer  cursor;
} VarLob;

// VarLobHead* lobHead = (VarLobHead*)varLob-&gt;data;
typedef struct StVarLobHead {
    CodUint64 lobId;
    CodUint16 couponSize;
    CodUint8  charLen : 3;
    CodUint8  isValidTempLob : 1;  // 是否为有效的temp lob
    CodUint8  isCreateTempLob : 1;  // 是否为createtemporary显式创建的temp lob
    CodUint8  isOpen : 1;  // 由temp lob使用的打开状态
    CodUint8  openMode : 1;  // 由temp lob使用的打开模式，只读为0，读写为1
    CodUint8  reserved : 1;
    CodUint8  isInRow : 1;
    CodUint8  varLobType : 3;
    CodUint8  isDataPtr : 1;
    CodUint8  hasLocator : 1;
    CodUint8  isCalcTemp : 1;
    CodUint8  unused : 1;
    union {
        CodChar        data[8];
        LobLocatorHead locatorHead;
        CodPointer     dataPtr;
    };
} VarLobHead;

// VarLobHead.LobLocatorHead
typedef struct StLobLocatorHead {
    CodUint64 endpoint : 16;
    CodUint64 lobSize : 48;
    CodChar data[0];
} LobLocatorHead;

// AnkLobLocator* locator=(AnkLobLocator*)lobHead-&gt;locatorHead.data
typedef struct StAnkLobLocator {
    CodUint64 lobId;
    CodUint64 tableId;
    RowId     rowId;
    Xid       xid;
    AnkScn    scn;
    CodUint32 ssn;
    CodUint16 colId;
    CodUint16 unused;
} AnkLobLocator;

// VarLobHead类型和LobCoupon类型可以相互转换
typedef struct StLobCoupon {
    CodUint64 lobId;
    CodUint16 couponSize;
    CodUint8  charLen : 3;
    CodUint8  reserved : 5;
    CodUint8  isInRow: 1;
    CodUint8  unused: 7;
    union {
        LobInode inode;
        CodChar  data[0];
    };
} LobCoupon;

// LobCoupon.LobInode
typedef struct StLobInode
{
    CodUint32    blockCount;
    CodUint16    remainedSize;
    CodUint16    columnId;
    SpaceBlockId blocks[0];
} LobInode;

// TempLobCoupon* tempCoupon = (TempLobCoupon*)lobHead-&gt;locatorHead.data
typedef struct StTempLobCoupon {
    CodUint32 vmBlockCount;
    CodUint32 vmStart;
    CodUint32 vmEnd;
    CodUint32 cacheId;
    CodUint16 remainedSize;
    CodUint16 unused;
} TempLobCoupon;

// knlLobOpenList的元素，list内存使用GlobalVarCtx.appHeap，list指针放在xrm上并在ankCloseHandler中置为NULL
typedef struct StKnlLobOpenItem {
    CodUint64 lobId;
    CodUint64 openMode : 1;
    CodUint64 unused : 63;
} KnlLobOpenItem;

// 收集移出knlLobOpenList的元素，便于复用
typedef struct StKnlLobCloseNode {
    KnlLobOpenItem* node;
    struct StKnlLobCloseNode* next;
} KnlLobCloseNode;

typedef struct StXrm {
    ...              ...
    ...              ...
    List*            knlLobOpenList;
    KnlLobCloseNode* knlLobCloseList;
} Xrm;

// AnlHandler.LobCacheCtx
typedef struct StLobCacheCtx {
    VmCacheList cacheVmList;
    AnlAppHeap  appHeap;
    CodUint32*  hashBuckets;
    List*       cachedLobs;
    IdList      freeList;
    CodUint64   createTempLobCount;  // v$temporary_lobs.nocache_lobs
} LobCacheCtx;

typedef struct StAnlStmt {
    ...               ...
    ...               ...
    VmCacheList       tempLobList;
    List*             tempLobCacheIdList;
    List*             memLobList;
    CodUint64         createTempLobCount;
    ...               ...
    ...               ...
} AnlStmt;

```

####   [5.2.2 DBMS_LOB相关流程](#522-dbms-lob相关流程)  

**createtemporary执行流程**

![](https://pingcode.yasdb.com/atlas/files/public/67396c22a1ad9a3311dc87e0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQWdBaUFBQUlCQWdnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUFBQUFBQUFBQmdBUUFDQUFBQUNBQUFBQUFBRUFBQUFBQUFCQUFBQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBQkFBQUFBQUNBQUFBQUFBQUFFQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkyMDgsImV4cCI6MTc4MjMxMDAwOH0.fMYCglOr_vWXSv7yGjcXr5bn3clti0B1gNA7zLAbhRU)

**freetemporary执行流程**

输入：lob_loc

（1）如果lob_loc.isNull == true，报错：参数不可为空

（2）如果lob_loc不是lob类型变量，报错：  无效的临时LOB定位符

（3）如果lob_loc不是temp lob，报错：  无效的临时LOB定位符

（4）如果lob_loc.isValidTempLob == false，报错：  无效的临时LOB定位符

（5）否则，令lob_loc.isValidTempLob = false。如果lob_loc.isCreateTempLob = true，则v$temporary_lobs.nocache_lobs -1

输出：lob_loc

  


**istemporary执行流程**

输入：lob_loc（非空的raw/char/varchar/nchar/nvarchar类型视为valid temp lob）

（1）如果lob_loc.isNull == true，返回NULL

（2）如果lob_loc不是temp lob，返回0

（3）如果lob_loc.isValidTempLob == false，返回0；否则，返回1

  


**open执行流程**

open_mode包括只读readonly = 0和读写readwrite = 1，输入数值范围内的其他数字默认为readonly

commit会检查是否存在未关闭的knl lob，即检查knlLobOpenList is null or empty。如果存在未关闭的knl lob，清空knlLobOpenList，报错：提交事务时存在未关闭的knl lob

![](https://pingcode.yasdb.com/atlas/files/public/67396c22a1ad9a3311dc87e1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQWdBaUFBQUlCQWdnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUFBQUFBQUFBQmdBUUFDQUFBQUNBQUFBQUFBRUFBQUFBQUFCQUFBQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBQkFBQUFBQUNBQUFBQUFBQUFFQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkyMDgsImV4cCI6MTc4MjMxMDAwOH0.fMYCglOr_vWXSv7yGjcXr5bn3clti0B1gNA7zLAbhRU)

**close执行流程**

输入：lob_loc

（1）如果lob_loc.isNull == true，报错：参数不可为空

（2）如果lob_loc是temp lob：

        a.如果lob_loc.isValidTempLob == false，报错：  无效的临时LOB定位符

        b.如果lob_loc.isOpened == false，报错：关闭未打开的lob

        c.否则，令lob_loc.isOpened = false

（3）如果lob_loc是knl lob：

       a.如果lob_loc在knlLobOpenList中，则从list中移除

       b.否则，报错：关闭未打开的lob

输出：lob_loc

  


**isopen执行流程**

输入：lob_loc

（1）如果lob_loc.isNull == true，报错：参数不可为空

（2）如果lob_loc是temp lob：

        a.如果lob_loc.isValidTempLob == false，报错：  无效的临时LOB定位符

        b.如果lob_loc.isOpened == false，返回0；否则，返回1

（3）如果lob_loc是knl lob：

        a.如果lob_loc在knlLobOpenList中，返回1；否则，返回0

  


**read执行流程**

![](https://pingcode.yasdb.com/atlas/files/public/67396c228970c2af4f520973/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQWdBaUFBQUlCQWdnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUFBQUFBQUFBQmdBUUFDQUFBQUNBQUFBQUFBRUFBQUFBQUFCQUFBQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBQkFBQUFBQUNBQUFBQUFBQUFFQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkyMDgsImV4cCI6MTc4MjMxMDAwOH0.fMYCglOr_vWXSv7yGjcXr5bn3clti0B1gNA7zLAbhRU)

**write执行流程**

执行lob写操作前会检查lob的打开模式：

（1）对于temp lob，如果.isOpen is true and .openMode is readonly则不可执行lob写操作

（2）对于knl lob，如果在knlLobOpenList中，并且openMode为readonly则不可执行lob写操作

当offset超过lob长度时，blob会补充零字节，clob会补充ascii空格，nclob会补充utf-16空格至满足offset的lob长度，然后再写入相应的数据

![](https://pingcode.yasdb.com/atlas/files/public/67396c22a1ad9a3311dc87e2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQWdBaUFBQUlCQWdnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUFBQUFBQUFBQmdBUUFDQUFBQUNBQUFBQUFBRUFBQUFBQUFCQUFBQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBQkFBQUFBQUNBQUFBQUFBQUFFQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkyMDgsImV4cCI6MTc4MjMxMDAwOH0.fMYCglOr_vWXSv7yGjcXr5bn3clti0B1gNA7zLAbhRU)

**append执行流程**

输入：dest_lob，src_lob

（1）dest_lob或src_lob.isNull == true，报错：参数不可为空

（2）dest_lob或src_lob.isValidTempLob == false，报错：无效的临时lob定位符

（3）dest_lob.openMode == readonly，报错：不能更新以只读模式打开的lob

（4）dest_lob.tryReplaceTempLobInRow，temp lob in row → temp lob out row

（5）src_lob.knlLobConvertToTempLob，knl lob in/out row → temp lob out row

（6）ankVarLobWrite(dest_lob, src_lob, LOB_WRITE_APPEND)

输出：dest_lob

  


**writeappend执行流程**

等同于write(lob_loc, amount, lob_len+1, buffer)

  


**copy执行流程**

类似于write(dest_lob, amount, dest_offset, buffer)，其中：

在检查amount参数时，amount(in)上限为bigint最大值。令left = src_lob_len+1-src_offset，当left < amount(in)时，amount = left；当left < 1时，流程结束（copy nothing，dest_lob内容不变）

buffer=anlLobSubStr(src_lob, amount, src_offset)，为temp lob out row

当dest_offset超过dest_lob长度时，blob会补充零字节，clob会补充ascii空格，nclob会补充utf-16空格至满足dest_offset的dest_lob长度，然后再写入相应的数据

对dest_offset参数的检查在src_offset参数之前

  


**erase执行流程**

类似于write(lob_loc, amount, offset, buffer)，其中：

在检查amount参数时，amount(in)上限为bigint最大值。令left = lob_len+1-offset，当left < amount(in)时，amount(out) = left；当left < 1时，流程结束（erase nothing）

当lob_loc为blob时，buffer为amount个0x00字节

当lob_loc为clob时，buffer为amount个空格字符

  


**trim执行流程**

输入：lob_loc，newlen

（1）lob_loc.isNull == true，报错：参数不可为空

（2）lob_loc.isValidTempLob == false，报错：无效的临时lob定位符

（3）lob_loc.openMode == readonly，报错：不能更新以只读模式打开的lob

（4）检查newlen参数是否满足0<=newlen<=lob_len，不满足则报错：参数值超出范围

（5）如果newlen == 0：

        a.令raw/(n)char/(n)varchar类型lob_loc.isNull = true

        b.令lob类型lob_loc.isNull = false，lob长度为0

（6）否则，ankVarLobWrite(lob_loc, newlen, NULL)

输出：lob_loc

  


**instr执行流程**

返回第n个匹配上的pattern首部在LOB中的偏移量，如果未找到则返回0，如果参数为NULL、为无效LOB定位符或超出数值范围则返回NULL

当offset > lob_len且不超出数值范围时，函数返回0

当nth大于实际能匹配上的最大个数且不超出数值范围时（即未找到第n个匹配），函数返回0

![](https://pingcode.yasdb.com/atlas/files/public/67396c228970c2af4f520974/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQWdBaUFBQUlCQWdnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUFBQUFBQUFBQmdBUUFDQUFBQUNBQUFBQUFBRUFBQUFBQUFCQUFBQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBQkFBQUFBQUNBQUFBQUFBQUFFQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkyMDgsImV4cCI6MTc4MjMxMDAwOH0.fMYCglOr_vWXSv7yGjcXr5bn3clti0B1gNA7zLAbhRU)

pattern max size = 32000 byte

buffer使用96000字节的栈空间，buffer的更新方法如下：

（1）如果pattern_len = 1，依次读96000字节的lob数据到buffer中

（2）如果pattern_len > 1，以offset为起点

        buffer1 = lob[0:96000]

        buffer2 = lob[96000-pattern_len+1:96000+pattern_len-1]

        buffer3 = lob[96000:192000]

        buffer4 = lob[192000-pattern_len+1:192000+pattern_len-1]

        buffer5 = lob[192000:288000]

        ...

       以此类推，总共更新buffer次数为2*floor[(lob_len-1)/96000]+1

  


####   [5.2.3 内置高级包支持变量](#523-内置高级包支持变量)  

**相关数据结构**

```
typedef struct StBipNameSpaceItem {
    AnlAppHeap        appHeap;
    CodChar           buf[COD_NAME_BUFFER_SIZE];
    CodText           packName;
    CodPointer        packContext;
    CodUint8          flag;
    CodUint8          unused[7];
    union {
        Variant*      headVars;
        AnlParamItem* headItem;
    };
} BipNameSpaceItem;

typedef struct StBipItem {
    CodText     name;
    BipItemType type;
    CodUint32   sid;
    union {
        // BIP_ITEM_FUNCTION / BIP_ITEM_PROCEDURE
        struct {
            CodPointer entry;
            CodPointer argList;
            CodUint32  argsCount;
        };
        // BIP_ITEM_PROPERTY
        struct {
            CodPointer packContext;
            CodPointer propertyText;
            CodPointer varDef;
            CodPointer propertyInit;
        };
        // BIP_ITEM_TYPE
        struct {
            CodPointer  typeText;
            CodPointer  typeDecl;
            CodPointer  typeInit;
        };
        BipException* exception;
    };
} BipItem;

```

**编译阶段适配**

1. soFindPackageItem阶段增加bipFindItem流程。尝试找到bipItem。
1. 首次访问创建和初始化bip的context。
1. 变量blockId注册为SO_GLOBAL_BLOCK_ID，addrType注册为VAR_ADDR_BIP。


**执行阶段适配**

1. 在soGetGlobalVarValue阶段，通过判断addrType为VAR_ADDR_BIP进入soGetBipVarValue流程。
1. 首次加在创建和初始化bipNamespace，变量存在bipNamespace的AnlAppHeap内。
1. 后续通过bip名字匹配对应的bipNamespaceItem。
1. 通过sid获取对应变量。


###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

- v$temporary_lobs视图中各字段的统计方式与oracle存在差异


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

（1）测试temp lob in row, temp lob out row, knl lob in row, knl lob out row四种类型lob的读写操作    
  （2）测试参数限制    
  （3）测试temp lob的创建和释放    
  （4）测试open/close    
  （5）测试输入utf-16字符    
  （6）测试使用绑定参数的场景    
  （7）测试高级包预定义常量能否正常使用    
  （8）测试方案涉及到的异常捕获

##   [7. Document（资料）](#7-document资料)  

  [Oracle Database 19c DBMS_LOB文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_LOB.html#GUID-A35DE03B-41A6-4E55-8CDE-77737FED9306)  

##   [8. Workload（工作量）](#8-workload工作量)  

工作量8人周

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

  


  


  


## Attachments:

[未命名文件 (12).png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjE4OTcwYzJhZjRmNTIwOTZlIiwicmVmX2lkIjoiNjczOTZjMjE3MjgyMDZlZmI5MmYwZTBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MjA4LCJleHAiOjE3ODIzODU2MDh9.O59e4FeVv-jrW_jiBA5nMO9M8S02wGlmzIhSlPmMubE)

 (image/png)    


[未命名文件 (14).png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjJhMWFkOWEzMzExZGM4N2RlIiwicmVmX2lkIjoiNjczOTZjMjE3MjgyMDZlZmI5MmYwZTBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MjA4LCJleHAiOjE3ODIzODU2MDh9.-41PkyCZ2qej6lVJzQ_yiQRyhvKyR6Ba3CJcoU6pNQM)

 (image/png)    


## Comments:

|  [](null)  ,写操作offset超出末尾补0字节或空格字符,Posted by zengsiyin at 十一月 15, 2023 17:16|
|---|
|  [](null)  ,测试高级包常量的使用，绑定参数，简单的语法错误,Posted by zengsiyin at 十一月 15, 2023 18:09|
|  [](null)  ,补充修改的数据结构,Posted by zengsiyin at 十一月 15, 2023 18:10|
