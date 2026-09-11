Created by 方少奎, last modified on 四月 01, 2024

![](https://pingcode.yasdb.com/atlas/files/public/67396e1b8970c2af4f5216b0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2MDEsImV4cCI6MTc4MjMzNTQwMX0.n7WVRuTTPk0fs7RWOLGoUewj7BAb-vA-S0-B_Ef4Skk)

  


##   [数据结构准备](#数据结构准备)  

OCI数据结构

```

typedef struct OCIStmt {
    YacUint32          handleType;
    YacUint8           unused[4];
    YacUint32          paramCount; // 解析的出参数个数
    YciStmtAttr        attr;
    YacHandle          yacStmt;
    OCISvcCtx*         yciSvcCtx;
    OCIEnv*            yciEnv;
    YacChar*           sqlStr;
    YciStmtRowDesc     rowDesc;
    YciStmtRowDefine   rowDefine;
    YciStmtParamBind   paramBind;
    YciStmtResultSet   resultSet;
    YciStmtParamSet    paramSet;
} OCIStmt;

typedef struct OCIBind {
    YacUint32         handleType;
    YacChar           name[YCI_PARAM_NAME_BUFFER_SIZE]; // 参数名称
    YacUint32         nameLen; // 参数名称长度，减少计算
    YacBool           valied;
    YacUint8          reserved[3];
    YacPointer        bindPtr;
    YacInt32          bindBufLen;
    YacUint16         ociBindType;
    YacUint8          unused[2];
    YacPointer        indicatorPtr;
    YacUint16*        actualLenPtr;
    YacUint16*        retCodePtr;
    YacUint32         maxArrLen;
    YacUint8          unused1[4];
    YacUint32*        curArrLenPtr;
    YciBindStructDef  bindStruct;
    YciBindDynamicDef bindDataAtExec;
} OCIBind;


```

YaCli数据结构

```
typedef struct StYacParamDesc {
    YacHandle nameList; // List&lt;YacParam&gt;*
    YacUint32 count;
} StYacParamDesc;


```

  


1、OCIStmt添加成员

typedef struct   OCIStmt   {    
  YacUint32   handleType  ;    
     YacUint8   unused  [  4  ]  ;    
     YciStmtAttr   attr  ;    
     YacHandle   yacStmt  ;    
     OCISvcCtx  *   yciSvcCtx  ;    
     OCIEnv  *   yciEnv  ;    
     YacChar  *   sqlStr  ;

YciStmtRowDesc   rowDesc  ;    
     YciStmtRowDefine   rowDefine  ;    
     YciStmtParamBind   paramBind  ;    
     YciStmtResultSet   resultSet  ;    
     YciStmtParamSet   paramSet  ;    
  }   OCIStmt  ;

初始化sqlStr时，清空posBindName

2、解析sql

逐字遍历sql，取出":.*"占位符

初始化posBindName

例：insert into table values(:val1, :val2, :val1)

|pos|1|2|3|
|---|---|---|---|
|name|:val1|:val2|:val1|


  


3、调用OCIBindByName时，遍历posBindName，将对应pos值覆盖

  


## Attachments: