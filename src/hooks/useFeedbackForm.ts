import { useState, useCallback } from 'react';

interface FeedbackFormData {
    starRating: number;
    suggestedGrade: string;
    comment: string;
    closedRoute: boolean;
}

interface UseFeedbackFormProps {
    initialData?: Partial<FeedbackFormData>;
    onSubmit: (data: FeedbackFormData) => Promise<void>;
}

export const useFeedbackForm = ({ initialData, onSubmit }: UseFeedbackFormProps) => {
    const [formData, setFormData] = useState<FeedbackFormData>({
        starRating: initialData?.starRating || 0,
        suggestedGrade: initialData?.suggestedGrade || '',
        comment: initialData?.comment || '',
        closedRoute: initialData?.closedRoute || true,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof FeedbackFormData, string>>>({});

    const updateField = useCallback(<K extends keyof FeedbackFormData>(
        field: K,
        value: FeedbackFormData[K]
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when field is updated
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    }, [errors]);

    const validateForm = useCallback((): boolean => {
        const newErrors: Partial<Record<keyof FeedbackFormData, string>> = {};

        if (formData.starRating === 0) {
            newErrors.starRating = 'דירוג נדרש';
        }

        if (!formData.comment.trim()) {
            newErrors.comment = 'תגובה נדרשת';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);

    const handleSubmit = useCallback(async () => {
        if (!validateForm() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onSubmit(formData);
        } catch (error) {
            console.error('Error submitting feedback:', error);
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    }, [formData, validateForm, onSubmit, isSubmitting]);

    const resetForm = useCallback(() => {
        setFormData({
            starRating: 0,
            suggestedGrade: '',
            comment: '',
            closedRoute: true,
        });
        setErrors({});
        setIsSubmitting(false);
    }, []);

    const updateFormData = useCallback((data: Partial<FeedbackFormData>) => {
        setFormData(prev => ({ ...prev, ...data }));
    }, []);

    return {
        formData,
        errors,
        isSubmitting,
        updateField,
        handleSubmit,
        resetForm,
        updateFormData,
        validateForm,
    };
};
