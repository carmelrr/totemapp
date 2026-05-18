/**
 * @fileoverview Locations manager + editor modal (CRUD for ClassLocation).
 */

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import type {
  ClassLocation,
  GroupType,
  LocationType,
} from "../types";
import { ALL_GROUP_TYPES, GROUP_TYPE_LABELS_HE } from "../constants";
import {
  addClassLocation,
  deleteClassLocation,
  updateClassLocation,
} from "../services/classLocationsService";
import { Btn, Card, Field, Row, SectionTitle } from "./ui";

interface Props {
  visible: boolean;
  locations: ClassLocation[];
  editingId: string | "new" | null;
  onClose: () => void;
  onPickEditing: (id: string | "new" | null) => void;
}

const LOCATION_TYPES: LocationType[] = ["wall", "kidsArea", "trainingArea", "other"];

function numOrZero(s: string) {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function LocationsManager({
  visible,
  locations,
  editingId,
  onClose,
  onPickEditing,
}: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const editing = useMemo<ClassLocation | null>(() => {
    if (editingId === "new") {
      return {
        name: "",
        type: "wall",
        lengthMeters: 0,
        usableLengthMeters: 0,
        maxParallelGroups: 1,
        allowedGroupTypes: [],
        active: true,
        order: locations.length,
      };
    }
    return locations.find((l) => l.id === editingId) ?? null;
  }, [editingId, locations]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.overlay,
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <View
          style={{
            backgroundColor: theme.modalBackground,
            width: "100%",
            maxWidth: 720,
            maxHeight: "90%",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <SectionTitle>{t.classes.locations}</SectionTitle>
            <Btn label="+" onPress={() => onPickEditing("new")} />
          </Row>

          <ScrollView style={{ maxHeight: 500 }}>
            {locations.length === 0 && (
              <Text
                style={{
                  color: theme.textSecondary,
                  textAlign: "right",
                  writingDirection: "rtl",
                  paddingVertical: 24,
                }}
              >
                {t.classes.noLocationsYet}
              </Text>
            )}
            {locations.map((loc) => (
              <Pressable
                key={loc.id}
                onPress={() => onPickEditing(loc.id ?? null)}
                style={{ marginBottom: 8 }}
              >
                <Card>
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 16,
                      fontWeight: "600",
                      writingDirection: "rtl",
                      textAlign: "right",
                    }}
                  >
                    {loc.name}{" "}
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                      ({t.classes[
                        `locationType${
                          loc.type.charAt(0).toUpperCase() + loc.type.slice(1)
                        }` as keyof typeof t.classes
                      ] as string})
                    </Text>
                  </Text>
                  <Text
                    style={{
                      color: theme.textSecondary,
                      writingDirection: "rtl",
                      textAlign: "right",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    {loc.lengthMeters}m / {loc.usableLengthMeters}m · max
                    {" "}{loc.maxParallelGroups}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </ScrollView>

          <Row style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <Btn label={t.classes.cancel} variant="ghost" onPress={onClose} />
          </Row>
        </View>

        {editing && (
          <LocationEditor
            initial={editing}
            isNew={editingId === "new"}
            onCancel={() => onPickEditing(null)}
            onSaved={() => onPickEditing(null)}
          />
        )}
      </View>
    </Modal>
  );
}

function LocationEditor({
  initial,
  isNew,
  onCancel,
  onSaved,
}: {
  initial: ClassLocation;
  isNew: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState<LocationType>(initial.type);
  const [length, setLength] = useState(String(initial.lengthMeters));
  const [usable, setUsable] = useState(String(initial.usableLengthMeters));
  const [maxParallel, setMaxParallel] = useState(String(initial.maxParallelGroups));
  const [allowed, setAllowed] = useState<GroupType[]>(initial.allowedGroupTypes);
  const [active, setActive] = useState(initial.active);

  const toggleAllowed = (g: GroupType) => {
    setAllowed((cur) =>
      cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g],
    );
  };

  const onSave = async () => {
    const payload = {
      name: name.trim() || "—",
      type,
      lengthMeters: numOrZero(length),
      usableLengthMeters: numOrZero(usable),
      maxParallelGroups: Math.max(1, Math.round(numOrZero(maxParallel))),
      allowedGroupTypes: allowed,
      active,
      order: initial.order ?? 0,
    };
    if (isNew) {
      await addClassLocation(payload);
    } else if (initial.id) {
      await updateClassLocation(initial.id, payload);
    }
    onSaved();
  };

  const onDelete = async () => {
    if (initial.id) await deleteClassLocation(initial.id);
    onSaved();
  };

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.overlay,
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
      }}
    >
      <View
        style={{
          backgroundColor: theme.modalBackground,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90%",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <SectionTitle>
          {isNew ? t.classes.addGroup : t.classes.edit}
        </SectionTitle>
        <ScrollView style={{ maxHeight: 480 }}>
          <Field label={t.classes.locationName} value={name} onChangeText={setName} />

          <Text
            style={{
              color: theme.textSecondary,
              writingDirection: "rtl",
              textAlign: "right",
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            {t.classes.locationType}
          </Text>
          <Row style={{ flexWrap: "wrap", marginBottom: 10 }}>
            {LOCATION_TYPES.map((lt) => (
              <Pressable
                key={lt}
                onPress={() => setType(lt)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 16,
                  backgroundColor: lt === type ? theme.buttonPrimary : "transparent",
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text
                  style={{
                    color: lt === type ? "#fff" : theme.text,
                    fontSize: 12,
                  }}
                >
                  {
                    t.classes[
                      `locationType${
                        lt.charAt(0).toUpperCase() + lt.slice(1)
                      }` as keyof typeof t.classes
                    ] as string
                  }
                </Text>
              </Pressable>
            ))}
          </Row>

          <Field
            label={t.classes.lengthMeters}
            value={length}
            onChangeText={setLength}
            keyboardType="decimal-pad"
          />
          <Field
            label={t.classes.usableLengthMeters}
            value={usable}
            onChangeText={setUsable}
            keyboardType="decimal-pad"
          />
          <Field
            label={t.classes.maxParallelGroups}
            value={maxParallel}
            onChangeText={setMaxParallel}
            keyboardType="numeric"
          />

          <Text
            style={{
              color: theme.textSecondary,
              writingDirection: "rtl",
              textAlign: "right",
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            {t.classes.allowedGroupTypes}
          </Text>
          <Row style={{ flexWrap: "wrap", marginBottom: 10 }}>
            {ALL_GROUP_TYPES.map((g) => (
              <Pressable
                key={g}
                onPress={() => toggleAllowed(g)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 16,
                  backgroundColor: allowed.includes(g) ? theme.buttonPrimary : "transparent",
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text
                  style={{
                    color: allowed.includes(g) ? "#fff" : theme.text,
                    fontSize: 12,
                  }}
                >
                  {GROUP_TYPE_LABELS_HE[g]}
                </Text>
              </Pressable>
            ))}
          </Row>

          <Pressable
            onPress={() => setActive((a) => !a)}
            style={{
              paddingVertical: 8,
              alignItems: "flex-end",
            }}
          >
            <Text style={{ color: theme.text, writingDirection: "rtl" }}>
              {active ? "✔ " : "○ "} {t.classes.active}
            </Text>
          </Pressable>
        </ScrollView>

        <Row style={{ marginTop: 12, justifyContent: "space-between" }}>
          <Btn
            label={t.classes.delete}
            variant="danger"
            onPress={onDelete}
            disabled={isNew}
          />
          <Row>
            <Btn label={t.classes.cancel} variant="ghost" onPress={onCancel} />
            <Btn label={t.classes.save} onPress={onSave} />
          </Row>
        </Row>
      </View>
    </View>
  );
}
